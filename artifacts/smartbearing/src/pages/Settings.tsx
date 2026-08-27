import { useState, useCallback, useRef, useEffect } from 'react';
import DashLayout from '@/components/layout/DashLayout';
import { sensorNodes } from '@/data/mockData';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Save, Plus, BellRing, Settings as SettingsIcon, Factory, CheckCircle2, Mail, MessageCircle } from 'lucide-react';
import { authApi, alertsApi, factoryUnitsApi, machinesApi, factoryProfileApi } from '@/lib/api';

export default function Settings() {
  const [anomalyWarning, setAnomalyWarning] = useState([0.35]);
  const [anomalyCritical, setAnomalyCritical] = useState([0.65]);
  const [tempWarning, setTempWarning] = useState([55]);
  const [tempCritical, setTempCritical] = useState([70]);
  const [vibWarning, setVibWarning] = useState([1.5]);
  const [vibCritical, setVibCritical] = useState([3.0]);
  const [alertEmail, setAlertEmail] = useState('');
  const [alertWhatsapp, setAlertWhatsapp] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [factoryUnits, setFactoryUnits] = useState<any[]>([]);
  const [allMachines, setAllMachines] = useState<any[]>([]);
  const [newUnit, setNewUnit] = useState({ unitId: '', name: '', location: '', description: '' });
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [profile, setProfile] = useState({ unitName: 'Factory Unit A', location: 'Sircilla, Telangana', shiftTimings: '24x7 (3 Shifts)', description: '' });
  const [sendingWa, setSendingWa] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the user's current alert email from the profile.
  useEffect(() => {
    authApi
      .me()
      .then((res) => {
        const user = res.data?.data ?? {};
        setAlertEmail(user.alertEmail || user.email || '');
        setAlertWhatsapp(user.alertWhatsapp || '');
      })
      .catch(() => {});
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const saveThresholds = () => notify(`Thresholds saved — anomaly warn ${anomalyWarning[0]}, crit ${anomalyCritical[0]}`);
  const saveNotifications = async () => {
    try {
      await authApi.updateMe({ alertEmail, alertWhatsapp });
      notify(alertWhatsapp ? `Saved — WhatsApp alerts will go to ${alertWhatsapp}` : alertEmail ? `Alert email saved — ${alertEmail}` : 'Notification settings saved');
    } catch {
      notify('Failed to save alert email');
    }
  };

  const sendTestEmail = async () => {
    setSendingTest(true);
    try {
      await alertsApi.sendTestEmail();
      notify(`Test alert email sent to ${alertEmail || 'your alert recipients'}`);
    } catch (err: any) {
      notify(err?.response?.data?.error || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };
  const sendTestWhatsApp = async () => {
    setSendingWa(true);
    try {
      if (alertWhatsapp) await authApi.updateMe({ alertWhatsapp });
      await alertsApi.sendTestWhatsApp();
      notify(`Test WhatsApp alert sent to ${alertWhatsapp}`);
    } catch (err: any) {
      notify(err?.response?.data?.error || 'Failed to send test WhatsApp');
    } finally {
      setSendingWa(false);
    }
  };
  const saveProfile = async () => {
    try {
      await factoryProfileApi.update(profile);
      notify('Factory profile saved!');
    } catch (err: any) {
      notify('Failed to save profile');
    }
  };

  const loadProfile = useCallback(() => {
    factoryProfileApi.get().then(res => {
      if (res.data?.data) {
        const p = res.data.data;
        setProfile({ unitName: p.unitName || '', location: p.location || '', shiftTimings: p.shiftTimings || '24x7 (3 Shifts)', description: p.description || '' });
      }
    }).catch(() => {});
  }, []);

  // Load factory units + profile
  useEffect(() => {
    factoryUnitsApi.getAll().then(res => {
      if (res.data?.data) setFactoryUnits(res.data.data);
    }).catch(() => {});
    machinesApi.getAll().then(res => {
      if (res.data?.data) setAllMachines(res.data.data);
    }).catch(() => {});
    loadProfile();
  }, [loadProfile]);

  const handleCreateUnit = async () => {
    if (!newUnit.unitId || !newUnit.name || !newUnit.location) {
      notify('Please fill in all required fields');
      return;
    }
    try {
      await factoryUnitsApi.create(newUnit);
      const res = await factoryUnitsApi.getAll();
      if (res.data?.data) setFactoryUnits(res.data.data);
      setNewUnit({ unitId: '', name: '', location: '', description: '' });
      notify('Factory unit created!');
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed to create factory unit');
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    try {
      await factoryUnitsApi.delete(unitId);
      const res = await factoryUnitsApi.getAll();
      if (res.data?.data) setFactoryUnits(res.data.data);
      notify('Factory unit removed');
    } catch (err: any) {
      notify('Failed to delete factory unit');
    }
  };

  const handleAssignMachines = async (unitId: string, machineIds: string[]) => {
    try {
      await factoryUnitsApi.assignMachines(unitId, machineIds);
      const res = await factoryUnitsApi.getAll();
      if (res.data?.data) setFactoryUnits(res.data.data);
      const machinesRes = await machinesApi.getAll();
      if (machinesRes.data?.data) setAllMachines(machinesRes.data.data);
      notify('Machines assigned!');
    } catch (err: any) {
      notify('Failed to assign machines');
    }
  };
  const addNode = () => notify('Coming soon: edge node provisioning is handled at the gateway');
  const configureNode = (id: string) => notify(`Opening configuration for node ${id}`);

  return (
    <DashLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-white tracking-wide">System Settings</h1>
          <p className="text-slate-400 mt-1">Configure edge intelligence parameters and factory details.</p>
        </div>

        <Tabs defaultValue="thresholds" className="w-full">
          <TabsList className="bg-[#0A0E1A] border border-navy mb-6">
            <TabsTrigger value="nodes" className="data-[state=active]:bg-navy-card data-[state=active]:text-amber text-slate-400">Sensor Nodes</TabsTrigger>
            <TabsTrigger value="thresholds" className="data-[state=active]:bg-navy-card data-[state=active]:text-amber text-slate-400">Alert Thresholds</TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-navy-card data-[state=active]:text-amber text-slate-400">Notifications</TabsTrigger>
            <TabsTrigger value="units" className="data-[state=active]:bg-navy-card data-[state=active]:text-amber text-slate-400">Factory Units</TabsTrigger>
            <TabsTrigger value="profile" className="data-[state=active]:bg-navy-card data-[state=active]:text-amber text-slate-400">Factory Profile</TabsTrigger>
          </TabsList>

          {/* TAB 1: SENSOR NODES */}
          <TabsContent value="nodes" className="space-y-4">
            <div className="flex justify-between items-center bg-navy-card border border-navy p-5 rounded-xl">
              <div>
                <h3 className="text-white font-bold text-lg">Active Nodes ({sensorNodes.length})</h3>
                <p className="text-slate-400 text-sm mt-1">Manage the edge sensor network across your machines.</p>
              </div>
              <Button onClick={addNode} className="bg-amber hover:bg-amber/90 text-navy font-bold">
                <Plus className="w-4 h-4 mr-2" /> Add New Node
              </Button>
            </div>
            
            <div className="bg-navy-card border border-navy rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#0A0E1A] text-slate-400 text-xs uppercase font-medium">
                    <tr>
                      <th className="px-6 py-4">Node ID</th>
                      <th className="px-6 py-4">Machine</th>
                      <th className="px-6 py-4">Location</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy">
                    {sensorNodes.map(node => (
                      <tr key={node.id} className="hover:bg-[#141E35] transition-colors">
                        <td className="px-6 py-4 font-mono-data text-slate-300">{node.id}</td>
                        <td className="px-6 py-4 text-slate-300">{node.machineId}</td>
                        <td className="px-6 py-4 text-slate-400">{node.location}</td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]"></span>
                            Online
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button onClick={() => configureNode(node.id)} variant="ghost" size="sm" className="h-8 text-slate-400 hover:text-white">Configure</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: THRESHOLDS */}
          <TabsContent value="thresholds" className="space-y-6">
            <div className="bg-navy-card border border-navy p-6 rounded-xl">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-navy">
                <SettingsIcon className="w-5 h-5 text-amber" />
                <div>
                  <h3 className="text-white font-bold text-lg">Edge AI Thresholds</h3>
                  <p className="text-slate-400 text-sm mt-1">Adjust the baseline sensitivity for the ML models on the nodes.</p>
                </div>
              </div>

              <div className="space-y-8 max-w-2xl">
                {/* Anomaly */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-sm font-medium text-slate-300">Composite Anomaly Score</label>
                    <div className="flex gap-4 font-mono-data text-sm">
                      <span className="text-[#F59E0B]">Warn: {anomalyWarning[0]}</span>
                      <span className="text-[#EA580C]">Crit: {anomalyCritical[0]}</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Slider value={anomalyWarning} onValueChange={setAnomalyWarning} max={1} step={0.01} className="w-full" />
                    <Slider value={anomalyCritical} onValueChange={setAnomalyCritical} max={1} step={0.01} className="w-full [&_[role=slider]]:border-[#EA580C]" />
                  </div>
                </div>

                {/* Vibration */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-sm font-medium text-slate-300">Vibration RMS (mm/s)</label>
                    <div className="flex gap-4 font-mono-data text-sm">
                      <span className="text-[#F59E0B]">Warn: {vibWarning[0]}</span>
                      <span className="text-[#EA580C]">Crit: {vibCritical[0]}</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Slider value={vibWarning} onValueChange={setVibWarning} max={10} step={0.1} className="w-full" />
                    <Slider value={vibCritical} onValueChange={setVibCritical} max={10} step={0.1} className="w-full [&_[role=slider]]:border-[#EA580C]" />
                  </div>
                </div>

                {/* Temperature */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-sm font-medium text-slate-300">Housing Temperature (°C)</label>
                    <div className="flex gap-4 font-mono-data text-sm">
                      <span className="text-[#F59E0B]">Warn: {tempWarning[0]}</span>
                      <span className="text-[#EA580C]">Crit: {tempCritical[0]}</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Slider value={tempWarning} onValueChange={setTempWarning} max={120} step={1} className="w-full" />
                    <Slider value={tempCritical} onValueChange={setTempCritical} max={120} step={1} className="w-full [&_[role=slider]]:border-[#EA580C]" />
                  </div>
                </div>

                <div className="pt-6">
                  <Button onClick={saveThresholds} className="bg-amber hover:bg-amber/90 text-navy font-bold">
                    <Save className="w-4 h-4 mr-2" /> Save Thresholds
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: NOTIFICATIONS */}
          <TabsContent value="notifications" className="space-y-6">
            <div className="bg-navy-card border border-navy p-6 rounded-xl max-w-2xl">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-navy">
                <BellRing className="w-5 h-5 text-amber" />
                <div>
                  <h3 className="text-white font-bold text-lg">Alert Routing</h3>
                  <p className="text-slate-400 text-sm mt-1">Configure where and when critical alerts are sent.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Alert Email</label>
                  <Input
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="bg-[#0A0E1A] border-navy text-white max-w-xs font-mono-data"
                  />
                  <p className="text-xs text-slate-500">Warnings and critical alerts are emailed here (falls back to your account email)</p>
                  <Button
                    onClick={sendTestEmail}
                    disabled={sendingTest}
                    className="mt-3 border border-amber/40 text-amber hover:bg-amber/10 font-semibold"
                    variant="outline"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    {sendingTest ? 'Sending…' : 'Send Test Alert Email'}
                  </Button>
                </div>

                <div className="space-y-2 pt-4 border-t border-navy/50">
                  <label className="text-sm font-medium text-slate-300">WhatsApp Alert Number</label>
                  <Input
                    type="tel"
                    value={alertWhatsapp}
                    onChange={(e) => setAlertWhatsapp(e.target.value)}
                    placeholder="+919876543210"
                    className="bg-[#0A0E1A] border-navy text-white max-w-xs font-mono-data"
                  />
                  <p className="text-xs text-slate-500">
                    Critical alerts are sent here via WhatsApp (Meta Cloud API — free test number included). Use international format incl. country code. Leave empty to disable.
                  </p>
                  <Button
                    onClick={sendTestWhatsApp}
                    disabled={sendingWa}
                    className="mt-3 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-semibold"
                    variant="outline"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    {sendingWa ? 'Sending…' : 'Send Test WhatsApp Alert'}
                  </Button>
                </div>

                <div className="space-y-4 pt-4 border-t border-navy/50">
                  {[
                    { label: 'Enable Email Alerts', desc: 'Send immediate emails for warning and critical events', checked: true },
                    { label: 'Critical Only', desc: 'Only send alerts when ETF is < 24 hours', checked: false },
                    { label: 'Daily Summary', desc: 'Receive a digest of fleet health every morning at 8 AM', checked: true },
                  ].map((setting, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="pt-1">
                        <input type="checkbox" defaultChecked={setting.checked} className="rounded border-navy bg-[#0A0E1A] text-amber focus:ring-amber w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-200">{setting.label}</div>
                        <div className="text-xs text-slate-400">{setting.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-4 border-t border-navy/50">
                  <label className="text-sm font-medium text-slate-300">Alert Cooldown</label>
                  <select className="w-full max-w-xs bg-[#0A0E1A] border border-navy text-white rounded-md h-10 px-3 text-sm focus:ring-amber focus:border-amber outline-none">
                    <option>1 Hour</option>
                    <option>4 Hours</option>
                    <option>12 Hours</option>
                    <option>24 Hours</option>
                  </select>
                  <p className="text-xs text-slate-500">Prevent spam for the same recurring issue</p>
                </div>

                <div className="pt-6 border-t border-navy">
                  <Button onClick={saveNotifications} className="bg-amber hover:bg-amber/90 text-navy font-bold">
                    <Save className="w-4 h-4 mr-2" /> Save Notification Settings
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: PROFILE */}
          <TabsContent value="units" className="space-y-6">
            {/* Create new factory unit */}
            <div className="bg-navy-card border border-navy p-6 rounded-xl max-w-2xl">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-navy">
                <Factory className="w-5 h-5 text-amber" />
                <div>
                  <h3 className="text-white font-bold text-lg">Add Factory Unit</h3>
                  <p className="text-slate-400 text-sm mt-1">Register a new factory location to monitor.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Unit ID *</label>
                    <Input value={newUnit.unitId} onChange={e => setNewUnit(p => ({ ...p, unitId: e.target.value }))} placeholder="e.g. unit-c" className="bg-[#0A0E1A] border-navy text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Unit Name *</label>
                    <Input value={newUnit.name} onChange={e => setNewUnit(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Factory Unit C" className="bg-[#0A0E1A] border-navy text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Location *</label>
                    <Input value={newUnit.location} onChange={e => setNewUnit(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Hyderabad, Telangana" className="bg-[#0A0E1A] border-navy text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Description</label>
                    <Input value={newUnit.description} onChange={e => setNewUnit(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" className="bg-[#0A0E1A] border-navy text-white" />
                  </div>
                </div>
                <Button onClick={handleCreateUnit} className="bg-amber hover:bg-amber/90 text-navy font-bold">
                  <Plus className="w-4 h-4 mr-2" /> Create Factory Unit
                </Button>
              </div>
            </div>

            {/* Existing factory units */}
            <div className="bg-navy-card border border-navy p-6 rounded-xl max-w-2xl">
              <h3 className="text-white font-bold text-lg mb-4">Existing Factory Units ({factoryUnits.length})</h3>
              {factoryUnits.length === 0 ? (
                <p className="text-slate-500 text-sm">No factory units yet. Create one above.</p>
              ) : (
                <div className="space-y-3">
                  {factoryUnits.map((unit) => {
                    const unitMachines = allMachines.filter(m => m.factoryUnit === unit.unitId);
                    return (
                      <div key={unit.unitId} className="p-4 rounded-lg bg-[#0A0E1A] border border-navy">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-white font-semibold">{unit.name}</span>
                            <span className="text-slate-500 text-xs ml-2">({unit.unitId})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{unit.machineCount || unitMachines.length} machines</span>
                            <button onClick={() => handleDeleteUnit(unit.unitId)} className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded border border-red-500/20 hover:border-red-500/40 transition-colors">Remove</button>
                          </div>
                        </div>
                        <p className="text-slate-400 text-xs mb-2">{unit.location}{unit.description ? ` — ${unit.description}` : ''}</p>
                        {unitMachines.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {unitMachines.map(m => (
                              <span key={m.machineId} className="text-[10px] px-2 py-0.5 rounded-full bg-navy border border-navy text-slate-300">{m.name || m.machineId}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <div className="bg-navy-card border border-navy p-6 rounded-xl max-w-2xl">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-navy">
                <Factory className="w-5 h-5 text-amber" />
                <div>
                  <h3 className="text-white font-bold text-lg">Factory Unit Profile</h3>
                  <p className="text-slate-400 text-sm mt-1">Manage physical location and operational metadata.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Unit Name</label>
                  <Input value={profile.unitName} onChange={e => setProfile(p => ({ ...p, unitName: e.target.value }))} className="bg-[#0A0E1A] border-navy text-white" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Location</label>
                  <Input value={profile.location} onChange={e => setProfile(p => ({ ...p, location: e.target.value }))} className="bg-[#0A0E1A] border-navy text-white" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Total Monitored Machines</label>
                    <Input value={allMachines.length.toString()} readOnly disabled className="bg-[#0A0E1A]/50 border-navy/50 text-slate-400 font-mono-data" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Shift Timings</label>
                    <select value={profile.shiftTimings} onChange={e => setProfile(p => ({ ...p, shiftTimings: e.target.value }))} className="w-full bg-[#0A0E1A] border border-navy text-white rounded-md h-10 px-3 text-sm focus:ring-amber focus:border-amber outline-none">
                      <option>24x7 (3 Shifts)</option>
                      <option>16x7 (2 Shifts)</option>
                      <option>12x6 (1.5 Shifts)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-navy mt-8">
                  <Button onClick={saveProfile} className="bg-amber hover:bg-amber/90 text-navy font-bold">
                    <Save className="w-4 h-4 mr-2" /> Save Profile
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl text-sm font-medium"
          style={{ background: '#0F1629', border: '1px solid #10B981', color: '#10B981' }}>
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}
    </DashLayout>
  );
}