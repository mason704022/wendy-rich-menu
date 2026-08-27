import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { compressImageForUpload } from "../lib/compressImage";
import { SessionThumb } from "./SessionThumb";

export interface WeekSessionTheme {
  weekStart: string;
  title: string;
  intro: string;
  image: string;
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(week.title);
    setIntro(week.intro);
    setImage(week.image);
  }, [week.weekStart, week.title, week.intro, week.image]);

  async function handleSave() {
    setSaving(true);
    onMessage({});
    try {
      await api(`/admin/session-themes/weekly?${adminQuery}`, {
        method: "PUT",
        body: JSON.stringify({
          weekStart: week.weekStart,
          title,
          intro,
          image,
          lineUserId,
        }),
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
        body: JSON.stringify({
          weekStart: week.weekStart,
          title,
          intro,
          image: imageUrl,
          lineUserId,
        }),
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
        {formatWeekRange(week.weekStart)} · 週三、五、六共用
      </p>
      {bookableSlots.length > 0 && (
        <ul className="admin-bookable-slots">
          {bookableSlots.map((slot) => (
            <li key={`${slot.slotDate}-${slot.startTime}`}>{slot.display}</li>
          ))}
        </ul>
      )}
      <p className="slot-meta" style={{ marginBottom: "12px" }}>
        此週課程套用於以上週三／週五／週六時段（含「我要預約」後續出現的場次）。
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
    return <p>載入課程主題…</p>;
  }

  return (
    <section className="info-card">
      <h2 className="admin-section-title">各週課程內容</h2>
      <p className="slot-meta" style={{ marginBottom: "0.75rem" }}>
        以週為單位設定後五週課程；同一週的週三、週五、週六共用標題、簡介與圖片。「我要預約」顯示後四週可選時段，會自動套用對應週次內容。
      </p>

      <div className="admin-theme-form" style={{ marginBottom: "0.75rem" }}>
        <label htmlFor="week-select">選擇週次（後五週）</label>
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

      <h2 className="admin-section-title">單堂特別主題</h2>
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
