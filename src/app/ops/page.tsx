"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  buildSigPreview,
  calculateQuantityFromParts,
  searchSigDefinitions,
  SIG_TEMPLATE_LIBRARY,
  type MedicationContext,
} from "@/lib/sig-engine";
import "./ops.css";

type Queue = "All orders" | "New" | "Preparing" | "Ready";

type Order = {
  id: string;
  customer: string;
  items: string;
  total: string;
  status: Exclude<Queue, "All orders">;
  timer: string;
  priority?: boolean;
};

const orders: Order[] = [
  { id: "TG-1048", customer: "Shifu M.", items: "2 x Mango Heatwave · Extra shot", total: "$31.50", status: "Preparing", timer: "08:42", priority: true },
  { id: "TG-1047", customer: "Jordan K.", items: "1 x Velvet Negroni · Large cup", total: "$18.90", status: "New", timer: "02:15" },
  { id: "TG-1046", customer: "Maya R.", items: "3 x Pink Paloma · Crushed ice", total: "$46.20", status: "Ready", timer: "14:05" },
  { id: "TG-1045", customer: "Theo B.", items: "1 x Shifu's Sunset · Berry crown", total: "$17.00", status: "Preparing", timer: "12:31" },
  { id: "TG-1044", customer: "Aisha N.", items: "4 x Garden Spritz · Party pack", total: "$52.00", status: "Ready", timer: "18:09" },
];

const navItems = ["Overview", "Orders", "Menu & inventory", "Drivers", "Reports"];
const medicationOptions = [
  { name: "Amoxicillin 500 mg", strength: "500 mg", form: "capsule", route: "oral", defaultUnit: "capsule" },
  { name: "Azithromycin 250 mg", strength: "250 mg", form: "tablet", route: "oral", defaultUnit: "tablet" },
  { name: "Aminophylline oral solution", strength: "50 mg/5 mL", form: "liquid", route: "oral", defaultUnit: "mL" },
  { name: "Prednisolone eye drops", strength: "1 mg/mL", form: "drop", route: "ophthalmic", defaultUnit: "drop" }
] as const;
const doseUnits = ["tablet", "capsule", "mL", "drop", "puff", "sachet", "application", "patch", "spray"];
const routes = [
  { value: "oral", label: "Oral" },
  { value: "topical", label: "Topical" },
  { value: "intramuscular", label: "Intramuscular" },
  { value: "intravenous", label: "Intravenous" },
  { value: "subcutaneous", label: "Subcutaneous" },
  { value: "ophthalmic", label: "Ophthalmic" },
  { value: "otic", label: "Otic" },
  { value: "nasal", label: "Nasal" },
  { value: "rectal", label: "Rectal" },
  { value: "vaginal", label: "Vaginal" },
  { value: "inhalation", label: "Inhalation" },
  { value: "sublingual", label: "Sublingual" },
  { value: "buccal", label: "Buccal" }
];
const frequencyOptions = [
  { value: "OD", label: "Once daily" },
  { value: "BD", label: "Twice daily" },
  { value: "TDS", label: "Three times daily" },
  { value: "QID", label: "Four times daily" },
  { value: "Q6H", label: "Every 6 hours" },
  { value: "Q8H", label: "Every 8 hours" },
  { value: "HS", label: "At bedtime" },
  { value: "STAT", label: "Immediately" },
  { value: "PRN", label: "As needed" }
];
const timingOptions = ["Before meals", "After meals", "With meals", "In the morning", "At bedtime", "With food", "On an empty stomach", "As prescribed"];

export default function OperationsPage() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [queue, setQueue] = useState<Queue>("All orders");
  const visibleOrders = queue === "All orders" ? orders : orders.filter((order) => order.status === queue);
  const [selectedMedication, setSelectedMedication] = useState<(typeof medicationOptions)[number]>(medicationOptions[0]);
  const [sigInput, setSigInput] = useState("1 BD X 5/7");
  const [doseValue, setDoseValue] = useState("1");
  const [doseUnit, setDoseUnit] = useState("tablet");
  const [route, setRoute] = useState("oral");
  const [frequency, setFrequency] = useState("BD");
  const [durationDays, setDurationDays] = useState("5");
  const [timing, setTiming] = useState("Before meals");
  const [additionalInstructions, setAdditionalInstructions] = useState("Complete the prescribed course.");
  const [auditEntries, setAuditEntries] = useState([
    { action: "Parsed", details: "1 BD X 5/7", user: "N. Okafor", time: "09:18" },
    { action: "Verified", details: "Take 1 tablet by mouth twice daily for 5 days.", user: "M. Moyo", time: "09:42" },
    { action: "Label ready", details: "Dispensing label generated", user: "Pharmacy team", time: "10:02" }
  ]);

  const medicationContext = useMemo<MedicationContext>(() => ({
    name: selectedMedication.name,
    strength: selectedMedication.strength,
    dosageForm: selectedMedication.form,
    route: route as MedicationContext["route"],
    defaultUnit: doseUnit
  }), [selectedMedication, route, doseUnit]);

  const suggestions = useMemo(() => searchSigDefinitions(sigInput, medicationContext), [sigInput, medicationContext]);
  const preview = useMemo(() => {
    const shorthand = sigInput.trim() || `${doseValue} ${frequency} X ${durationDays}/7`;
    return buildSigPreview(shorthand, medicationContext);
  }, [sigInput, doseValue, frequency, durationDays, medicationContext]);

  const quantityPreview = useMemo(() => calculateQuantityFromParts({
    doseValue: Number(doseValue || 1),
    doseUnit,
    frequencyValue: preview.frequency?.value ?? null,
    durationValue: preview.duration?.value ?? Number(durationDays || 0)
  }), [doseValue, doseUnit, preview.frequency, preview.duration, durationDays]);

  return (
    <main className="ops-shell">
      <aside className="ops-sidebar">
        <Link className="ops-brand" href="/"><span>✦</span> TIPSYGO</Link>
        <div className="location-chip"><span className="live-dot" /> Westside bar <small>Open</small></div>
        <nav className="ops-nav" aria-label="Operations navigation">
          {navItems.map((item) => <button className={activeNav === item ? "active" : ""} key={item} onClick={() => setActiveNav(item)}><span className="nav-icon">{["⌂", "◴", "▦", "↗", "▤"][navItems.indexOf(item)]}</span>{item}{item === "Orders" && <b>5</b>}</button>)}
        </nav>
        <div className="sidebar-footer"><div className="staff-avatar">N</div><div><strong>Nia Okafor</strong><small>Manager</small></div><button aria-label="Open staff menu">⋯</button></div>
      </aside>
      <section className="ops-content">
        <header className="ops-header"><div><p className="ops-kicker">Monday, 05 October 2026 <span>•</span> Service is live</p><h1>{activeNav}</h1></div><div className="ops-header-actions"><button className="outline-ops-button">Download report <span>↓</span></button><button className="ops-notification" aria-label="Notifications">♢<i>3</i></button></div></header>
        <div className="metric-grid"><article><p>Today&apos;s revenue</p><strong>$2,840.50</strong><small className="positive">↑ 18.4% vs last Monday</small></article><article><p>Orders today</p><strong>86</strong><small className="positive">↑ 12.1% vs last Monday</small></article><article><p>Average order value</p><strong>$33.03</strong><small className="positive">↑ 4.7% vs last Monday</small></article><article className="accent-metric"><p>Active drivers</p><strong>4 <span>/ 6</span></strong><small>2 available for dispatch</small></article></div>

        <section className="sig-engine-panel">
          <div className="sig-engine-header">
            <div>
              <p className="ops-kicker">Clinical dispensing • safety-first workflow</p>
              <h2>Smart SIG Prescription Directions Engine</h2>
            </div>
            <button className="outline-ops-button">Pharmacist verification required</button>
          </div>

          <div className="sig-grid">
            <div className="sig-card">
              <p className="sig-label">Medication</p>
              <select className="sig-select" value={selectedMedication.name} onChange={(event) => {
                const nextMedication = medicationOptions.find((option) => option.name === event.target.value) ?? medicationOptions[0];
                setSelectedMedication(nextMedication);
                setDoseUnit(nextMedication.defaultUnit ?? "tablet");
              }}>
                {medicationOptions.map((option) => <option key={option.name} value={option.name}>{option.name} • {option.strength}</option>)}
              </select>

              <div className="sig-input-wrap">
                <input
                  className="sig-input"
                  value={sigInput}
                  onChange={(event) => setSigInput(event.target.value)}
                  placeholder="Enter SIG code, e.g. 1 BD X 5/7"
                  aria-label="SIG code"
                />
                {sigInput && suggestions.length > 0 && (
                  <ul className="sig-suggestions" role="listbox" aria-label="SIG suggestions">
                    {suggestions.map((suggestion) => (
                      <li key={suggestion.code}>
                        <button type="button" onClick={() => setSigInput(suggestion.code)}>
                          <strong>{suggestion.code}</strong>
                          <span>{suggestion.canonicalMeaning}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="sig-builder-grid">
                <div className="sig-builder-field">
                  <label htmlFor="sig-dose">Dose</label>
                  <input id="sig-dose" value={doseValue} onChange={(event) => setDoseValue(event.target.value)} />
                </div>
                <div className="sig-builder-field">
                  <label htmlFor="sig-unit">Dosage unit</label>
                  <select id="sig-unit" value={doseUnit} onChange={(event) => setDoseUnit(event.target.value)}>
                    {doseUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                </div>
                <div className="sig-builder-field">
                  <label htmlFor="sig-route">Route</label>
                  <select id="sig-route" value={route} onChange={(event) => setRoute(event.target.value)}>
                    {routes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <div className="sig-builder-field">
                  <label htmlFor="sig-frequency">Frequency</label>
                  <select id="sig-frequency" value={frequency} onChange={(event) => setFrequency(event.target.value)}>
                    {frequencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="sig-builder-field">
                  <label htmlFor="sig-duration">Duration</label>
                  <input id="sig-duration" value={durationDays} onChange={(event) => setDurationDays(event.target.value)} />
                </div>
                <div className="sig-builder-field">
                  <label htmlFor="sig-timing">Timing</label>
                  <select id="sig-timing" value={timing} onChange={(event) => setTiming(event.target.value)}>
                    {timingOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>

              <div className="sig-additional">
                <label htmlFor="sig-additional">Additional instructions</label>
                <textarea id="sig-additional" rows={3} value={additionalInstructions} onChange={(event) => setAdditionalInstructions(event.target.value)} />
              </div>
            </div>

            <div className="sig-card">
              <p className="sig-label">Live directions preview</p>
              <div className="sig-preview-box">
                <p className="sig-preview-title">{selectedMedication.name}</p>
                <strong>{preview.instructions}</strong>
              </div>

              <div className="sig-mini-grid">
                <div>
                  <span>Calculated quantity</span>
                  <strong>{quantityPreview.value ?? "manual review"}</strong>
                </div>
                <div>
                  <span>Verification status</span>
                  <strong>{preview.validation.status}</strong>
                </div>
              </div>

              <div className="sig-checklist">
                <div className={preview.validation.status === "valid" ? "sig-row success" : "sig-row"}><span>Validation</span><b>{preview.validation.message}</b></div>
                <div className="sig-row"><span>Quantity unit</span><b>{quantityPreview.unit}</b></div>
                <div className="sig-row"><span>Route</span><b>{preview.route ?? "not specified"}</b></div>
                <div className="sig-row"><span>Duration</span><b>{preview.duration ? `${preview.duration.value} ${preview.duration.unit}` : "not specified"}</b></div>
              </div>

              <div className="sig-actions">
                <button type="button" className="primary-button" onClick={() => setAuditEntries((current) => [{ action: "Verified", details: preview.instructions, user: "Pharmacist Moyo", time: "Now" }, ...current].slice(0, 5))}>Apply instructions</button>
                <button type="button" className="outline-button" onClick={() => setAuditEntries((current) => [{ action: "Saved template", details: `${selectedMedication.name} • ${preview.instructions}`, user: "You", time: "Now" }, ...current].slice(0, 5))}>Save as favourite</button>
              </div>
            </div>
          </div>

          <div className="sig-bottom-grid">
            <div className="sig-card">
              <div className="sig-panel-header">
                <p className="sig-label">Approved templates</p>
                <span className="sig-badge">Pharmacy approved</span>
              </div>
              <div className="template-list">
                {SIG_TEMPLATE_LIBRARY.map((template) => (
                  <button key={template.name} type="button" className="template-item" onClick={() => setSigInput(`${template.structuredInstructions.dose} ${template.structuredInstructions.frequency} X ${template.structuredInstructions.duration.replace(/\D/g, "")}/7`)}>
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sig-card">
              <div className="sig-panel-header">
                <p className="sig-label">Verification history</p>
                <span className="sig-badge">Audit trail</span>
              </div>
              <div className="audit-list">
                {auditEntries.map((entry) => (
                  <div className="audit-row" key={`${entry.action}-${entry.time}-${entry.details}`}>
                    <div>
                      <strong>{entry.action}</strong>
                      <span>{entry.details}</span>
                    </div>
                    <small>{entry.user} • {entry.time}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="ops-main-grid"><section className="queue-panel"><div className="panel-heading"><div><p className="ops-kicker">Live kitchen queue</p><h2>Orders in motion</h2></div><span className="queue-status"><i /> Live</span></div><div className="queue-tabs">{(["All orders", "New", "Preparing", "Ready"] as Queue[]).map((item) => <button key={item} className={queue === item ? "active" : ""} onClick={() => setQueue(item)}>{item}<span>{item === "All orders" ? orders.length : orders.filter((order) => order.status === item).length}</span></button>)}</div><div className="order-list">{visibleOrders.map((order) => <article className={order.priority ? "queue-order priority" : "queue-order"} key={order.id}><div className={`queue-state ${order.status.toLowerCase()}`}><span>{order.status === "New" ? "✦" : order.status === "Preparing" ? "◌" : "✓"}</span></div><div className="order-detail"><div className="order-title"><strong>{order.id}</strong>{order.priority && <em>Priority</em>}<small>{order.customer}</small></div><p>{order.items}</p></div><div className="order-side"><strong>{order.total}</strong><span className={order.status === "Preparing" ? "timer active" : "timer"}>{order.status === "Preparing" && "◷ "}{order.timer}</span></div><button className="order-more" aria-label={`Open ${order.id}`}>→</button></article>)}</div><button className="view-orders">Open order management <span>↗</span></button></section><section className="revenue-panel"><div className="panel-heading"><div><p className="ops-kicker">Performance</p><h2>Revenue</h2></div><button className="period-select">This week⌄</button></div><div className="revenue-total"><strong>$14.2k</strong><span className="positive">↑ 16.8%</span></div><div className="chart"><div className="chart-grid"><span>$4k</span><span>$3k</span><span>$2k</span><span>$1k</span></div><div className="bars">{[58, 72, 49, 86, 64, 93, 77].map((height, index) => <div className="bar-wrap" key={index}><div className={index === 4 ? "bar current" : "bar"} style={{ height: `${height}%` }} /><small>{["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"][index]}</small></div>)}</div></div><div className="top-sip"><span>Top seller</span><strong>Mango Heatwave</strong><small>142 sold this week <b>↗ 22%</b></small></div></section></div>
        <section className="lower-grid"><div className="prep-panel"><div className="panel-heading"><div><p className="ops-kicker">Team pulse</p><h2>Preparation today</h2></div><button className="dots-button" aria-label="More preparation options">⋯</button></div><div className="prep-stat"><strong>11m 24s</strong><span>Average prep time</span><div className="prep-track"><i style={{ width: "68%" }} /></div><small className="positive">On target · under 15m</small></div><div className="staff-list"><div><span className="staff-dot coral">A</span><strong>Amara</strong><small>12 orders · 9m avg</small><b>Online</b></div><div><span className="staff-dot lavender">D</span><strong>Diego</strong><small>8 orders · 13m avg</small><b>Online</b></div><div><span className="staff-dot acid">K</span><strong>Kemi</strong><small>Break · returns 14:20</small><b className="off">Away</b></div></div></div><div className="driver-panel"><div className="panel-heading"><div><p className="ops-kicker">Dispatch</p><h2>Driver readiness</h2></div><span className="queue-status"><i /> 4 online</span></div><div className="driver-row"><span className="staff-dot lavender">J</span><div><strong>James K.</strong><small>2 deliveries · Westside</small></div><span className="driver-ready">Ready</span></div><div className="driver-row"><span className="staff-dot coral">L</span><div><strong>Leila S.</strong><small>1 delivery · Riverside</small></div><span className="driver-busy">On route</span></div><div className="driver-row"><span className="staff-dot acid">M</span><div><strong>Marcus T.</strong><small>Available · 0 deliveries</small></div><span className="driver-ready">Ready</span></div><button className="view-orders">Manage drivers <span>↗</span></button></div></section>
      </section>
    </main>
  );
}
