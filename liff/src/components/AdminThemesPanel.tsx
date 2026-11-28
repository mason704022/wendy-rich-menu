import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { compressImageForUpload } from "../lib/compressImage";
import { SessionThumb } from "./SessionThumb";

export type SlotBookingEnabled = Partial<Record<3 | 5 | 6, boolean>>;

export interface WeekSessionTheme {
  weekStart: string;
  title: string;
  intro: string;
  image: string;
  slotBookingEnabled?: SlotBookingEnabled;
}

export interface SessionThemeOverride {
  slotDate: string;
  startTime: string;
  title: string;
  intro: string;
  image: string;
}

export interface AdminWeekSlotRef {
  slotDate: string;
  label: string;
  startTime: string;
  endTime: string;
  display: string;
}

export interface AdminWeekRef {
  weekStart: string;
  weekLabel: string;
  slots: AdminWeekSlotRef[];
}

export interface SlotOption {
  weekday: number;
  label: string;
  startTime: string;
  endTime: string;
  display: string;
}

interface Props {
  adminQuery: string;
  lineUserId: string;
  onMessage: (msg: { error?: string; success?: string }) => void;
}

const SLOT_TOGGLE_ROWS: { weekday: 3 | 5 | 6; label: string; time: string }[] = [
  { weekday: 3, label: "週三", time: "09:00–11:00" },
  { weekday: 5, label: "週五", time: "19:00–21:00" },
  { weekday: 6, label: "週六", time: "09:00–11:00" },
];

function defaultSlotBookingEnabled(): SlotBookingEnabled {
  return { 3: true, 5: true, 6: true };
}

function mergeSlotBookingEnabled(stored?: SlotBookingEnabled): SlotBookingEnabled {
  const base = defaultSlotBookingEnabled();
  if (!stored) return base;
  return {
    3: stored[3] !== false,
    5: stored[5] !== false,
    6: stored[6] !== false,
  };
}

function weekdayForSlot(slot: AdminWeekSlotRef): 3 | 5 | 6 | null {
  const row = SLOT_TOGGLE_ROWS.find(
    (r) => r.label === slot.label && r.time.startsWith(slot.startTime)
  );
  return row?.weekday ?? null;
}

function formatWeekRange(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

async function uploadImage(file: File, adminQuery: string): Promise<string> {
  const dataUrl = await compressImageForUpload(file);

  const res = await api<{ imageUrl: string }>(
    `/admin/session-themes/upload-image?${adminQuery}`,
    {
      method: "POST",
      body: JSON.stringify({ imageBase64: dataUrl }),
    }
  );
  return res.imageUrl;
}

function WeeklyEditor({
  week,
  bookableSlots,
  isCurrentWeek,
  adminQuery,
  lineUserId,
  onSaved,
  onMessage,
}: {
  week: WeekSessionTheme;
  bookableSlots: AdminWeekSlotRef[];
  isCurrentWeek: boolean;
  adminQuery: string;
  lineUserId: string;
  onSaved: () => void;
  onMessage: Props["onMessage"];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(week.title);
  const [intro, setIntro] = useState(week.intro);
  const [image, setImage] = useState(week.image);
  const [slotBookingEnabled, setSlotBookingEnabled] = useState<SlotBookingEnabled>(
    () => mergeSlotBookingEnabled(week.slotBookingEnabled)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(week.title);
    setIntro(week.intro);
    setImage(week.image);
    setSlotBookingEnabled(mergeSlotBookingEnabled(week.slotBookingEnabled));
  }, [week.weekStart, week.title, week.intro, week.image, week.slotBookingEnabled]);

  function buildSaveBody(extra?: { image?: string }) {
    return {
      weekStart: week.weekStart,
      title,
      intro,
      image: extra?.image ?? image,
      lineUserId,
      slotBookingEnabled,
    };
  }

  async function handleSave() {
    setSaving(true);
    onMessage({});
    try {
      await api(`/admin/session-themes/weekly?${adminQuery}`, {
        method: "PUT",
        body: JSON.stringify(buildSaveBody()),
      });
      onMessage({ success: `已儲存 ${formatWeekRange(week.weekStart)} 課程` });
      onSaved();
    } catch (err) {
      onMessage({ error: err instanceof Error ? err.message : "儲存失敗" });
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    onMessage({});
    try {
      const imageUrl = await uploadImage(file, adminQuery);
      setImage(imageUrl);
      await api(`/admin/session-themes/weekly?${adminQuery}`, {
        method: "PUT",
        body: JSON.stringify(buildSaveBody({ image: imageUrl })),
      });
      onMessage({ success: "圖片已上傳並儲存" });
      onSaved();
    } catch (err) {
      onMessage({ error: err instanceof Error ? err.message : "上傳失敗" });
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="slot-card admin-theme-card">
      <p className="slot-meta">
        {isCurrentWeek ? "本週 · " : ""}
        {formatWeekRange(week.weekStart)} · 內容週三、五、六共用，預約可個別開關
      </p>
      {bookableSlots.length > 0 && (
        <ul className="admin-bookable-slots">
          {bookableSlots.map((slot) => {
            const wd = weekdayForSlot(slot);
            const enabled = wd != null ? slotBookingEnabled[wd] !== false : true;
            return (
              <li
                key={`${slot.slotDate}-${slot.startTime}`}
                className={enabled ? undefined : "admin-slot-disabled"}
              >
                {slot.display}
                <span className="admin-slot-badge">
                  {enabled ? "開放預約" : "不開放預約"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <fieldset className="admin-slot-toggle-fieldset">
        <legend className="admin-slot-toggle-legend">開放預約</legend>
        <p className="slot-meta">
          關閉後，學員在可訂日期內不會看到該堂。不影響已預約名單；特別班不受此開關影響。
        </p>
        {SLOT_TOGGLE_ROWS.map((row) => (
          <label key={row.weekday} className="admin-slot-toggle-row">
            <span className="admin-slot-toggle-label">
              {row.label} {row.time}
            </span>
            <input
              type="checkbox"
              checked={slotBookingEnabled[row.weekday] !== false}
              onChange={(e) =>
                setSlotBookingEnabled((prev) => ({
                  ...prev,
                  [row.weekday]: e.target.checked,
                }))
              }
            />
            <span className="slot-meta">
              {slotBookingEnabled[row.weekday] !== false ? "開啟" : "關閉"}
            </span>
          </label>
        ))}
      </fieldset>
      <p className="slot-meta" style={{ marginBottom: "12px" }}>
        標題、簡介、圖片套用於本週仍「開放預約」的週三／週五／週六（含日後進入訂課窗口的場次）。
      </p>
      <div className="admin-theme-preview">
        {image ? <SessionThumb src={image} className="slot-thumb" /> : null}
        <div className="admin-theme-form" style={{ flex: 1 }}>
          <label htmlFor={`title-${week.weekStart}`}>標題</label>
          <input
            id={`title-${week.weekStart}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label htmlFor={`intro-${week.weekStart}`}>簡介</label>
          <textarea
            id={`intro-${week.weekStart}`}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
          />
        </div>
      </div>
      <div className="admin-theme-actions">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="admin-file-input"
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="btn btn-outline"
          disabled={saving}
          onClick={() => fileRef.current?.click()}
        >
          更換圖片
        </button>
        <button
          type="button"
          className="btn btn-purple"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "處理中…" : "儲存此週課程"}
        </button>
      </div>
    </div>
  );
}

function OverrideEditor({
  override,
  slotOptions,
  adminQuery,
  lineUserId,
  onSaved,
  onDeleted,
  onMessage,
}: {
  override?: SessionThemeOverride;
  slotOptions: SlotOption[];
  adminQuery: string;
  lineUserId: string;
  onSaved: () => void;
  onDeleted: () => void;
  onMessage: Props["onMessage"];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isNew = !override;
  const [slotDate, setSlotDate] = useState(override?.slotDate ?? "");
  const [startTime, setStartTime] = useState(override?.startTime ?? slotOptions[0]?.startTime ?? "09:00");
  const [title, setTitle] = useState(override?.title ?? "");
  const [intro, setIntro] = useState(override?.intro ?? "");
  const [image, setImage] = useState(override?.image ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!image) {
      onMessage({ error: "請上傳示範圖" });
      return;
    }
    setSaving(true);
    onMessage({});
    try {
      if (isNew) {
        await api(`/admin/session-themes/overrides?${adminQuery}`, {
          method: "POST",
          body: JSON.stringify({ slotDate, startTime, title, intro, image, lineUserId }),
        });
        onMessage({ success: "已新增特別班" });
      } else {
        await api(`/admin/session-themes/overrides?${adminQuery}`, {
          method: "PUT",
          body: JSON.stringify({ slotDate, startTime, title, intro, image, lineUserId }),
        });
        onMessage({ success: "已更新特別班" });
      }
      onSaved();
    } catch (err) {
      onMessage({ error: err instanceof Error ? err.message : "儲存失敗" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!override || !confirm("確定刪除此特別班？")) return;
    setSaving(true);
    onMessage({});
    try {
      await api(`/admin/session-themes/overrides?${adminQuery}`, {
        method: "DELETE",
        body: JSON.stringify({
          slotDate: override.slotDate,
          startTime: override.startTime,
          lineUserId,
        }),
      });
      onMessage({ success: "已刪除特別班" });
      onDeleted();
    } catch (err) {
      onMessage({ error: err instanceof Error ? err.message : "刪除失敗" });
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    onMessage({});
    try {
      const imageUrl = await uploadImage(file, adminQuery);
      setImage(imageUrl);
      onMessage({ success: "圖片已上傳" });
    } catch (err) {
      onMessage({ error: err instanceof Error ? err.message : "上傳失敗" });
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="slot-card admin-theme-card">
      <div className="admin-theme-form">
        <label htmlFor={`od-${override?.slotDate ?? "new"}`}>日期</label>
        <input
          id={`od-${override?.slotDate ?? "new"}`}
          type="date"
          value={slotDate}
          disabled={!isNew}
          onChange={(e) => setSlotDate(e.target.value)}
        />
        <label htmlFor={`ot-${override?.slotDate ?? "new"}`}>時段</label>
        <select
          id={`ot-${override?.slotDate ?? "new"}`}
          value={startTime}
          disabled={!isNew}
          onChange={(e) => setStartTime(e.target.value)}
        >
          {slotOptions.map((o) => (
            <option key={o.startTime} value={o.startTime}>
              {o.display}
            </option>
          ))}
        </select>
        <label>標題</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        <label>簡介</label>
        <textarea value={intro} onChange={(e) => setIntro(e.target.value)} />
      </div>
      {image && (
        <div className="admin-theme-preview">
          <SessionThumb src={image} className="slot-thumb" />
        </div>
      )}
      <div className="admin-theme-actions">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="admin-file-input"
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="btn btn-outline"
          disabled={saving}
          onClick={() => fileRef.current?.click()}
        >
          {image ? "更換圖片" : "上傳圖片"}
        </button>
        <button
          type="button"
          className="btn btn-purple"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "處理中…" : isNew ? "新增" : "儲存"}
        </button>
        {!isNew && (
          <button
            type="button"
            className="btn btn-outline"
            disabled={saving}
            onClick={handleDelete}
          >
            刪除
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminThemesPanel({ adminQuery, lineUserId, onMessage }: Props) {
  const [weeks, setWeeks] = useState<WeekSessionTheme[]>([]);
  const [adminWeeks, setAdminWeeks] = useState<AdminWeekRef[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState("");
  const [selectedWeekStart, setSelectedWeekStart] = useState("");
  const [overrides, setOverrides] = useState<SessionThemeOverride[]>([]);
  const [slotOptions, setSlotOptions] = useState<SlotOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOverride, setShowNewOverride] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  async function loadThemes() {
    setLoading(true);
    try {
      const data = await api<{
        weeks: WeekSessionTheme[];
        adminWeeks: AdminWeekRef[];
        overrides: SessionThemeOverride[];
        slotOptions: SlotOption[];
        currentWeekStart: string;
      }>(`/admin/session-themes?${adminQuery}`);
      setWeeks(data.weeks);
      setAdminWeeks(data.adminWeeks);
      setOverrides(data.overrides);
      setSlotOptions(data.slotOptions);
      setCurrentWeekStart(data.currentWeekStart);
      setSelectedWeekStart((prev) =>
        prev && data.weeks.some((w) => w.weekStart === prev)
          ? prev
          : data.weeks[0]?.weekStart ?? ""
      );
    } catch (err) {
      onMessage({ error: err instanceof Error ? err.message : "載入主題失敗" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadThemes();
  }, [adminQuery]);

  const selectedWeek =
    weeks.find((w) => w.weekStart === selectedWeekStart) ?? weeks[0] ?? null;
  const selectedAdminWeek =
    adminWeeks.find((w) => w.weekStart === selectedWeekStart) ?? null;

  if (loading && weeks.length === 0) {
    return <p>載入課程管理…</p>;
  }

  return (
    <section className="info-card">
      <h2 className="admin-section-title">各週課程內容</h2>
      <p className="slot-meta" style={{ marginBottom: "0.75rem" }}>
        以週為單位設定後八週課程；同一週共用標題、簡介與圖片，並可個別關閉週三／週五／週六是否開放預約。學員僅能在訂課窗口內看到「開放」的時段。
      </p>

      <div className="admin-theme-form" style={{ marginBottom: "0.75rem" }}>
        <label htmlFor="week-select">選擇週次（後八週）</label>
        <select
          id="week-select"
          value={selectedWeekStart}
          onChange={(e) => setSelectedWeekStart(e.target.value)}
        >
          {adminWeeks.map((aw) => {
            const isCurrent = aw.weekStart === currentWeekStart;
            return (
              <option key={aw.weekStart} value={aw.weekStart}>
                {isCurrent ? "本週 · " : ""}
                {aw.weekLabel}
              </option>
            );
          })}
        </select>
      </div>

      {selectedWeek && (
        <WeeklyEditor
          key={`${selectedWeek.weekStart}-${reloadKey}`}
          week={selectedWeek}
          bookableSlots={selectedAdminWeek?.slots ?? []}
          isCurrentWeek={selectedWeek.weekStart === currentWeekStart}
          adminQuery={adminQuery}
          lineUserId={lineUserId}
          onMessage={onMessage}
          onSaved={() => {
            setReloadKey((k) => k + 1);
            void loadThemes();
          }}
        />
      )}

      <h2 className="admin-section-title">單堂節慶體驗主題</h2>
      {overrides.map((o) => (
        <OverrideEditor
          key={`${o.slotDate}-${o.startTime}-${reloadKey}`}
          override={o}
          slotOptions={slotOptions}
          adminQuery={adminQuery}
          lineUserId={lineUserId}
          onMessage={onMessage}
          onSaved={() => {
            setReloadKey((k) => k + 1);
            void loadThemes();
          }}
          onDeleted={() => {
            setReloadKey((k) => k + 1);
            void loadThemes();
          }}
        />
      ))}

      {showNewOverride ? (
        <OverrideEditor
          key={`new-${reloadKey}`}
          slotOptions={slotOptions}
          adminQuery={adminQuery}
          lineUserId={lineUserId}
          onMessage={onMessage}
          onSaved={() => {
            setShowNewOverride(false);
            setReloadKey((k) => k + 1);
            void loadThemes();
          }}
          onDeleted={() => setShowNewOverride(false)}
        />
      ) : (
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setShowNewOverride(true)}
        >
          新增特別班
        </button>
      )}
    </section>
  );
}
