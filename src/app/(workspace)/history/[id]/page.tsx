import { HistoryDetail } from "@/components/history-detail";
export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <HistoryDetail id={id} />; }
