import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { LoadError, apiErrorMessage } from "../components/LoadError";
import { PageShell } from "../components/PageShell";
import { LocationMap } from "../components/LocationMap";

interface AboutTab {
  id: string;
  label: string;
  heading?: string;
  lines: string[];
  showMap?: boolean;
}

function AboutTabBody({ tab }: { tab: AboutTab }) {
  const faqLines = tab.lines.every((line) => line.startsWith("- "));
  const bodyLines = faqLines ? tab.lines : tab.lines;

  return (
    <>
      {tab.heading && <h3 className="about-tab-heading">{tab.heading}</h3>}
      {faqLines ? (
        <ul className="about-tab-list">
          {bodyLines.map((line) => (
            <li key={line}>{line.replace(/^- /, "")}</li>
          ))}
        </ul>
      ) : (
        bodyLines.map((line) => (
          <p
            key={line}
            className={
              line.startsWith("如果你看到這裡")
                ? "about-tab-text about-tab-accent"
                : "about-tab-text"
            }
          >
            {line}
          </p>
        ))
      )}
    </>
  );
}

interface CourseContent {
  title: string;
  courseName: string;
  introduction: string;
  targetAudience: string;
  teachingMethod: string;
  features: string;
  includes: string;
  sessionRule: string;
  capacity: string;
  schedule: string;
  duration: string;
  price: string;
  venue: { name: string; address: string; mapUrl: string };
  aboutTabs?: AboutTab[];
}

export function CoursesPage() {
  const navigate = useNavigate();
  const [content, setContent] = useState<CourseContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("a");

  const loadContent = useCallback(() => {
    setLoading(true);
    setError("");
    api<CourseContent>("/courses/")
      .then((data) => {
        setContent(data);
        const first = data.aboutTabs?.[0]?.id;
        if (first) setActiveTab(first);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  if (loading) return <div className="loading">載入中…</div>;
  if (error) return <LoadError message={error} onRetry={loadContent} />;
  if (!content) return <LoadError onRetry={loadContent} />;

  const tabs = content.aboutTabs ?? [];
  const current = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <PageShell title={content.title} leftAlign>
      {tabs.length > 0 && (
        <>
          <div className="about-tabs" role="tablist" aria-label="認識我們分頁">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`about-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {current && (
            <section className="info-card about-tab-panel" role="tabpanel">
              <AboutTabBody tab={current} />
              {current.showMap && (
                <div className="about-tab-map">
                  <LocationMap />
                  <a
                    className="store-link"
                    href={content.venue.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    在 Google 地圖開啟
                  </a>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <div className="purchase-footer">
        <button
          type="button"
          className="btn btn-purple btn-lg"
          onClick={() => navigate("/purchase")}
        >
          選擇我的課程
        </button>
      </div>
    </PageShell>
  );
}
