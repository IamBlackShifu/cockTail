"use client";

import { useState } from "react";
import Link from "next/link";
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

export default function OperationsPage() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [queue, setQueue] = useState<Queue>("All orders");
  const visibleOrders = queue === "All orders" ? orders : orders.filter((order) => order.status === queue);

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
        <div className="ops-main-grid"><section className="queue-panel"><div className="panel-heading"><div><p className="ops-kicker">Live kitchen queue</p><h2>Orders in motion</h2></div><span className="queue-status"><i /> Live</span></div><div className="queue-tabs">{(["All orders", "New", "Preparing", "Ready"] as Queue[]).map((item) => <button key={item} className={queue === item ? "active" : ""} onClick={() => setQueue(item)}>{item}<span>{item === "All orders" ? orders.length : orders.filter((order) => order.status === item).length}</span></button>)}</div><div className="order-list">{visibleOrders.map((order) => <article className={order.priority ? "queue-order priority" : "queue-order"} key={order.id}><div className={`queue-state ${order.status.toLowerCase()}`}><span>{order.status === "New" ? "✦" : order.status === "Preparing" ? "◌" : "✓"}</span></div><div className="order-detail"><div className="order-title"><strong>{order.id}</strong>{order.priority && <em>Priority</em>}<small>{order.customer}</small></div><p>{order.items}</p></div><div className="order-side"><strong>{order.total}</strong><span className={order.status === "Preparing" ? "timer active" : "timer"}>{order.status === "Preparing" && "◷ "}{order.timer}</span></div><button className="order-more" aria-label={`Open ${order.id}`}>→</button></article>)}</div><button className="view-orders">Open order management <span>↗</span></button></section><section className="revenue-panel"><div className="panel-heading"><div><p className="ops-kicker">Performance</p><h2>Revenue</h2></div><button className="period-select">This week⌄</button></div><div className="revenue-total"><strong>$14.2k</strong><span className="positive">↑ 16.8%</span></div><div className="chart"><div className="chart-grid"><span>$4k</span><span>$3k</span><span>$2k</span><span>$1k</span></div><div className="bars">{[58, 72, 49, 86, 64, 93, 77].map((height, index) => <div className="bar-wrap" key={index}><div className={index === 4 ? "bar current" : "bar"} style={{ height: `${height}%` }} /><small>{["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"][index]}</small></div>)}</div></div><div className="top-sip"><span>Top seller</span><strong>Mango Heatwave</strong><small>142 sold this week <b>↗ 22%</b></small></div></section></div>
        <section className="lower-grid"><div className="prep-panel"><div className="panel-heading"><div><p className="ops-kicker">Team pulse</p><h2>Preparation today</h2></div><button className="dots-button" aria-label="More preparation options">⋯</button></div><div className="prep-stat"><strong>11m 24s</strong><span>Average prep time</span><div className="prep-track"><i style={{ width: "68%" }} /></div><small className="positive">On target · under 15m</small></div><div className="staff-list"><div><span className="staff-dot coral">A</span><strong>Amara</strong><small>12 orders · 9m avg</small><b>Online</b></div><div><span className="staff-dot lavender">D</span><strong>Diego</strong><small>8 orders · 13m avg</small><b>Online</b></div><div><span className="staff-dot acid">K</span><strong>Kemi</strong><small>Break · returns 14:20</small><b className="off">Away</b></div></div></div><div className="driver-panel"><div className="panel-heading"><div><p className="ops-kicker">Dispatch</p><h2>Driver readiness</h2></div><span className="queue-status"><i /> 4 online</span></div><div className="driver-row"><span className="staff-dot lavender">J</span><div><strong>James K.</strong><small>2 deliveries · Westside</small></div><span className="driver-ready">Ready</span></div><div className="driver-row"><span className="staff-dot coral">L</span><div><strong>Leila S.</strong><small>1 delivery · Riverside</small></div><span className="driver-busy">On route</span></div><div className="driver-row"><span className="staff-dot acid">M</span><div><strong>Marcus T.</strong><small>Available · 0 deliveries</small></div><span className="driver-ready">Ready</span></div><button className="view-orders">Manage drivers <span>↗</span></button></div></section>
      </section>
    </main>
  );
}
