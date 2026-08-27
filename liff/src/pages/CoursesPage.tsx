import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { LoadError, apiErrorMessage } from "../components/LoadError";
import { PageShell } from "../components/PageShell";
import { LocationMap } from "../components/LocationMap";

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
}

export function CoursesPage() {
  const navigate = useNavigate();
  const [content, setContent] = useState<CourseContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadContent = useCallback(() => {
    setLoading(true);
    setError("");
    api<CourseContent>("/courses/")
      .then(setContent)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  if (loading) return <div className="loading">載入中…</div>;
  if (error) return <LoadError message={error} onRetry={loadContent} />;
  if (!content) return <LoadError onRetry={loadContent} />;

  return (
    <PageShell title="課程資訊" leftAlign>
      <section className="info-card">
        <h2>{content.courseName}</h2>
        <p className="info-lead">{content.introduction}</p>
        <dl className="info-dl">
          <div>
            <dt>適合對象</dt>
            <dd>{content.targetAudience}</dd>
          </div>
          <div>
            <dt>教學方式</dt>
            <dd>{content.teachingMethod}</dd>
          </div>
          <div>
            <dt>課程特色</dt>
            <dd>{content.features}</dd>
          </div>
          <div>
            <dt>包含內容</dt>
            <dd>{content.includes}</dd>
          </div>
          <div>
            <dt>堂數規則</dt>
            <dd>{content.sessionRule}</dd>
          </div>
          <div>
            <dt>名額</dt>
            <dd>{content.capacity}</dd>
          </div>
          <div>
            <dt>時長</dt>
            <dd>{content.duration}</dd>
          </div>
          <div>
            <dt>時段</dt>
            <dd>{content.schedule}</dd>
          </div>
          <div>
            <dt>費用</dt>
            <dd>{content.price}</dd>
          </div>
        </dl>
      </section>

      <section className="info-card">
        <h3>上課地點</h3>
        <p>
          <strong>{content.venue.name}</strong> · {content.venue.address}
        </p>
        <LocationMap />
        <a className="store-link" href={content.venue.mapUrl} target="_blank" rel="noreferrer">
          在 Google 地圖開啟
        </a>
      </section>

      <div className="purchase-footer">
        <button
          type="button"
          className="btn btn-purple btn-lg"
          onClick={() => navigate("/purchase")}
        >
          購買課程
        </button>
      </div>
    </PageShell>
  );
}
