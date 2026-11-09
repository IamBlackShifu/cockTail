import { DriverHandover } from "@/components/driver-handover";
import "./driver.css";

export default async function DriverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <DriverHandover token={token} />;
}
