import { useCallback, useEffect, useState } from "react";
import { api, apiOptional } from "../lib/api";
import { closeLiff, getProfile } from "../lib/liff";
import { LoadError, apiErrorMessage } from "../components/LoadError";
import { PlanSelector, type PlanCategory, type PaymentInfo } from "../components/PlanSelector";
import { PurchaseLanding } from "../components/PurchaseLanding";
import { RegisterForm, useMemberRegistered } from "../components/RegisterForm";

interface Terms {
  title: string;
  intro: string[];
  sections: string[];
  disclaimer?: string;
}

type View = "landing" | "register" | "plans";

export function PurchasePage() {
  const { registered, setRegistered, profile } = useMemberRegistered();
  const [view, setView] = useState<View>("landing");
  const [terms, setTerms] = useState<Terms | null>(null);
  const [categories, setCategories] = useState<PlanCategory[]>([]);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [defaultPayerName, setDefaultPayerName] = useState("");
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadInitialData = useCallback(() => {
    setInitialLoading(true);
    setLoadError("");
    Promise.all([
      api<Terms>("/members/content/terms"),
      api<{ categories: PlanCategory[] }>("/purchases/plans"),
      api<PaymentInfo>("/purchases/payment-info"),
    ])
      .then(([t, p, pay]) => {
        setTerms(t);
        setCategories(p.categories);
        setPayment(pay);
        if (p.categories[0]?.plans[0]) {
          setSelectedPlanId(p.categories[0].plans[0].id);
        }
      })
      .catch((err) => setLoadError(apiErrorMessage(err)))
      .finally(() => setInitialLoading(false));
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!registered) return;
    apiOptional<{ member?: { name: string } }>(`/members/${profile.userId}`).then(
      (d) => {
        if (d?.member?.name) setDefaultPayerName(d.member.name);
      }
    );
  }, [registered, profile.userId]);

  if (registered === null || initialLoading) {
    return <div className="loading">載入中…</div>;
  }

  if (loadError) {
    return <LoadError message={loadError} onRetry={loadInitialData} />;
  }

  if (!terms || !payment || categories.length === 0) {
    return <LoadError onRetry={loadInitialData} />;
  }

  function goNextFromLanding() {
    if (!registered) {
      setView("register");
      return;
    }
    setView("plans");
  }

  function afterRegistered() {
    setRegistered(true);
    setView("plans");
  }

  async function submitPayment(data: { payerName: string; transferLast5: string }) {
    if (!selectedPlanId) return;
    setLoading(true);
    setError("");
    try {
      const p = getProfile();
      const res = await api<{ purchase: { id: number } }>("/purchases/", {
        method: "POST",
        body: JSON.stringify({
          lineUserId: p.userId,
          planId: selectedPlanId,
          payerName: data.payerName,
          transferLast5: data.transferLast5,
        }),
      });
      setOrderId(res.purchase.id);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="purchase-page">
        <div className="success-screen">
          <h1 className="brand-title">Wendy</h1>
          <div className="success-box">
            已收到您的匯款通知！
            {orderId != null && (
              <>
                <br />
                訂單編號：#{orderId}
              </>
            )}
            <br />
            工作室將於 1-2 個工作天確認並更新堂數。
          </div>
          <button className="btn btn-purple btn-lg" onClick={closeLiff}>
            關閉
          </button>
        </div>
      </div>
    );
  }

  if (view === "register") {
    return (
      <RegisterForm onRegistered={afterRegistered} onCancel={() => setView("landing")} />
    );
  }

  if (view === "plans") {
    return (
      <>
        {error && <div className="error-box plan-error">{error}</div>}
        <PlanSelector
          categories={categories}
          payment={payment}
          selectedPlanId={selectedPlanId}
          onSelectPlan={(id) => setSelectedPlanId(id || null)}
          onSubmit={submitPayment}
          loading={loading}
          onBack={() => setView("landing")}
          defaultPayerName={defaultPayerName}
        />
      </>
    );
  }

  return <PurchaseLanding terms={terms} onNext={goNextFromLanding} />;
}
