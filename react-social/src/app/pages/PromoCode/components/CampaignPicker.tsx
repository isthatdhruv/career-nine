import { useEffect, useState } from "react"
import { getAllCampaigns } from "../../B2C/API/Campaign_APIs"

type Campaign = { campaignId: number; name: string }

export type CampaignPickerProps = {
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}

const CampaignPicker = ({ selectedIds, onChange, disabled }: CampaignPickerProps) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllCampaigns()
      .then((res: any) => {
        const list: Campaign[] = (res.data || []).map((c: any) => ({
          campaignId: c.campaignId,
          name: c.name,
        }))
        setCampaigns(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const toggle = (id: number) => {
    if (disabled) return
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id))
    else onChange([...selectedIds, id])
  }

  if (loading) return <div className="text-muted">Loading campaigns...</div>
  if (campaigns.length === 0) return <div className="text-muted">No campaigns available.</div>

  return (
    <div>
      {campaigns.map((c) => (
        <label key={c.campaignId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={selectedIds.includes(c.campaignId)}
            onChange={() => toggle(c.campaignId)}
            disabled={disabled}
          />
          <span>{c.name}</span>
        </label>
      ))}
    </div>
  )
}

export default CampaignPicker
