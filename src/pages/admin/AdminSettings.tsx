import { useEffect, useState } from 'react';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { AdminPage } from '../../components/AdminPage';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface SettingsData {
  totalNumbers: number;
  totalCalls: number;
  totalMessages: number;
  apiStatus: {
    telnyx: boolean;
    supabase: boolean;
    upstash: boolean;
    korapay: boolean;
  };
  pricing: {
    coinsPerUsd: number;
    smsCoinsPerSegment: number;
    mmsCoinsPerMessage: number;
    numberSubscriptionCoins: number;
    outboundCallCoinsPerSecond: number;
    inboundCallCoinsPerSecond: number;
    callRecordingCoinsPerMinute: number;
  };
  admins: AdminUser[];
}

function ApiStatusIndicator({ name, connected }: { name: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="font-body-md text-on-surface">{name}</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[#00a651] animate-pulse' : 'bg-error'}`} />
        <span className={`text-xs font-bold uppercase ${connected ? 'text-[#00a651]' : 'text-error'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  );
}

function PricingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="font-body-md text-on-surface-variant">{label}</span>
      <span className="font-body-md font-medium text-on-surface">{value}</span>
    </div>
  );
}

export default function AdminSettings() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setError('No active session.');
          setLoading(false);
          return;
        }

        const res = await axios.get('/api/admin?action=settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (err: unknown) {
        const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load settings.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <AdminPage title="Settings" subtitle="Platform configuration, API status, and system information.">
      {loading && (
        <div className="admin-card-lg admin-section text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="admin-card-lg admin-section text-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="admin-grid grid-cols-1 lg:grid-cols-2 admin-section">
          <div className="admin-card-lg">
            <div className="flex items-center gap-sm mb-md">
              <span className="material-symbols-outlined text-primary">tune</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">Platform Pricing</h4>
            </div>
            <div className="divide-y divide-outline-variant/10">
              <PricingRow label="Coins per USD" value={`${data.pricing.coinsPerUsd} coins`} />
              <PricingRow label="SMS cost per segment" value={`${data.pricing.smsCoinsPerSegment} coins`} />
              <PricingRow label="MMS cost per message" value={`${data.pricing.mmsCoinsPerMessage} coins`} />
              <PricingRow label="Number subscription (30 days)" value={`${data.pricing.numberSubscriptionCoins} coins`} />
              <PricingRow label="Outbound call rate" value={`$${(data.pricing.outboundCallCoinsPerSecond * 60).toFixed(0)}/min`} />
              <PricingRow label="Inbound call rate" value={`$${(data.pricing.inboundCallCoinsPerSecond * 60).toFixed(0)}/min`} />
              <PricingRow label="Call recording" value={`${data.pricing.callRecordingCoinsPerMinute} coins/min`} />
            </div>
          </div>

          <div className="admin-card-lg">
            <div className="flex items-center gap-sm mb-md">
              <span className="material-symbols-outlined text-primary">api</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">API Status</h4>
            </div>
            <div className="divide-y divide-outline-variant/10">
              <ApiStatusIndicator name="Telnyx" connected={data.apiStatus.telnyx} />
              <ApiStatusIndicator name="Supabase" connected={data.apiStatus.supabase} />
              <ApiStatusIndicator name="Upstash Redis" connected={data.apiStatus.upstash} />
              <ApiStatusIndicator name="Korapay" connected={data.apiStatus.korapay} />
            </div>
          </div>

          <div className="admin-card-lg">
            <div className="flex items-center gap-sm mb-md">
              <span className="material-symbols-outlined text-primary">shield_person</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">Admin Users</h4>
            </div>
            <div className="space-y-sm">
              {data.admins.length === 0 && (
                <p className="text-on-surface-variant text-sm italic">No admin users found.</p>
              )}
              {data.admins.map((admin) => (
                <div key={admin.id} className="flex items-center gap-sm">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs overflow-hidden">
                    {admin.avatar ? (
                      <img src={admin.avatar} alt={admin.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      admin.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="font-body-md font-medium text-on-surface">{admin.name}</p>
                    <p className="text-on-surface-variant text-xs">{admin.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-card-lg">
            <div className="flex items-center gap-sm mb-md">
              <span className="material-symbols-outlined text-primary">analytics</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">System Information</h4>
            </div>
            <div className="divide-y divide-outline-variant/10">
              <PricingRow label="Total Phone Numbers" value={data.totalNumbers.toLocaleString()} />
              <PricingRow label="Total Messages" value={data.totalMessages.toLocaleString()} />
              <PricingRow label="Total Calls" value={data.totalCalls.toLocaleString()} />
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
