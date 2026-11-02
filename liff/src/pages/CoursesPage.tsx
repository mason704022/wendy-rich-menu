import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { LoadError, apiErrorMessage } from "../components/LoadError";
import { PageShell } from "../components/PageShell";
import { LocationMap } from "../components/LocationMap";

interface AboutSection {
  heading: string;
  lines: string[];
  showMap?: boolean;
}

interface AboutTab {
  id: string;
  label: string;
  heading?: string;
  lines?: string[];
  sections?: AboutSection[];
  showMap?: boolean;
}

function renderAboutLine(text: string) {
  const parts = text.split(/(\[\[accent\]\][\s\S]*?\[\[\/accent\]\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[\[accent\]\]([\s\S]*?)\[\[\/accent\]\]$/);
    if (match) {
      return (
        <span key={index} className="about-tab-accent">
          {match[1]}
        </span>
      );
    }
    return part;
  });
}

function AboutLines({ lines }: { lines: string[] }) {
  const faqLines = lines.every((line) => line.startsWith("- "));

  if (faqLines) {
    return (
      <ul className="about-tab-list">
        {lines.map((line) => (
          <li key={line}>{renderAboutLine(line.replace(/^- /, ""))}</li>
        ))}
      </ul>
    );
  }

  return (
    <>
      {lines.map((line) => (
        <p
          key={line}
          className={
            line.startsWith("如果你看到這裡")
              ? "about-tab-text about-tab-accent"
              : "about-tab-text"
          }
        >
          {renderAboutLine(line)}
        </p>
      ))}
    </>
  );
}

function AboutTabBody({
  tab,
  mapUrl,
}: {
  tab: AboutTab;
  mapUrl: string;
}) {
  if (tab.sections && tab.sections.length > 0) {
    return (
      <div className="about-stacked-sections">
        {tab.sections.map((section) => (
          <article key={section.heading} className="about-stacked-card">
            <h4 className="about-stacked-heading">{section.heading}</h4>
            <AboutLines lines={section.lines} />
            {section.showMap && (
              <div className="about-tab-map">
                <LocationMap />
                <a className="store-link" href={mapUrl} target="_blank" rel="noreferrer">
                  在 Google 地圖開啟
                </a>
              </div>
            )}
          </article>
        ))}
      </div>
    );
  }

  const lines = tab.lines ?? [];

  return (
    <>
      {tab.heading && <h3 className="about-tab-heading">{tab.heading}</h3>}
      <AboutLines lines={lines} />
      {tab.showMap && (
        <div className="about-tab-map">
          <LocationMap />
          <a className="store-link" href={mapUrl} target="_blank" rel="noreferrer">
            在 Google 地圖開啟
          </a>
        </div>
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
  const [activeTab, setActiveTab] = useState("course");

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
  const stackedLayout = Boolean(current?.sections?.length);

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
            <section
              className={`info-card about-tab-panel ${stackedLayout ? "about-tab-panel-stacked" : ""}`}
              role="tabpanel"
            >
              <AboutTabBody tab={current} mapUrl={content.venue.mapUrl} />
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
