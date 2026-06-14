import type { Campaign, CampaignChannel } from "@/types";

interface CampaignRowProps {
  campaign: Campaign;
  onApprove?: (id: string) => void;
  onLaunch?: (id: string) => void;
}

const CHANNEL_ICONS: Record<CampaignChannel, string> = {
  whatsapp: "💬",
  sms: "📱",
  email: "✉️",
  rcs: "📩",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-gray-500",
  pending_approval: "text-yellow-600",
  approved: "text-blue-600",
  running: "text-green-600",
  completed: "text-purple-600",
  cancelled: "text-red-600",
};

export default function CampaignRow({ campaign, onApprove, onLaunch }: CampaignRowProps) {
  return (
    <tr className="hover:bg-muted/50 transition-colors">
      <td className="px-4 py-3">
        {CHANNEL_ICONS[campaign.channel]} {campaign.name}
      </td>
      <td className="px-4 py-3 uppercase text-xs">{campaign.channel}</td>
      <td className={`px-4 py-3 capitalize font-medium ${STATUS_COLORS[campaign.status]}`}>
        {campaign.status.replace("_", " ")}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {campaign.stats.sent} / {campaign.stats.delivered} / {campaign.stats.opened}
      </td>
      <td className="px-4 py-3">
        {campaign.status === "draft" && onApprove && (
          <button
            onClick={() => onApprove(campaign._id)}
            className="text-xs text-blue-600 hover:underline mr-2"
          >
            Approve
          </button>
        )}
        {campaign.status === "approved" && onLaunch && (
          <button
            onClick={() => onLaunch(campaign._id)}
            className="text-xs text-green-600 hover:underline"
          >
            Launch
          </button>
        )}
      </td>
    </tr>
  );
}
