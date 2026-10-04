import { MarketingFrame } from "@/components/marketing-frame";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingFrame>{children}</MarketingFrame>;
}
