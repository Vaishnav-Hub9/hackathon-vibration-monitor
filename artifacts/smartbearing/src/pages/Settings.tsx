import { useState } from 'react';
import DashLayout from '@/components/layout/DashLayout';
import { sensorNodes } from '@/data/mockData';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Save, Plus, BellRing, Settings as SettingsIcon, Factory } from 'lucide-react';

export default function Settings() {
  const [anomalyWarning, setAnomalyWarning] = useState([0.35]);
  const [anomalyCritical, setAnomalyCritical] = useState([0.65]);
  const [tempWarning, setTempWarning] = useState([55]);
  const [tempCritical, setTempCritical] = useState([70]);
  const [vibWarning, setVibWarning] = useState([1.5]);
  const [vibCritical, setVibCritical] = useState([3.0]);

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
            <TabsTrigger value="profile" className="data-[state=active]:bg-navy-card data-[state=active]:text-amber text-slate-400">Factory Profile</TabsTrigger>
          </TabsList>

          {/* TAB 1: SENSOR NODES */}
          <TabsContent value="nodes" className="space-y-4">
            <div className="flex justify-between items-center bg-navy-card border border-navy p-5 rounded-xl">
              <div>
                <h3 className="text-white font-bold text-lg">Active Nodes ({sensorNodes.length})</h3>
                <p className="text-slate-400 text-sm mt-1">Manage the edge sensor network across your machines.</p>
              </div>
              <Button className="bg-amber hover:bg-amber/90 text-navy font-bold">
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
                          <Button variant="ghost" size="sm" className="h-8 text-slate-400 hover:text-white">Configure</Button>
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
                  <Button className="bg-amber hover:bg-amber/90 text-navy font-bold">
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
                  <label className="text-sm font-medium text-slate-300">Primary WhatsApp Number</label>
                  <Input defaultValue="+91 98765 43210" className="bg-[#0A0E1A] border-navy text-white max-w-xs font-mono-data" />
                  <p className="text-xs text-slate-500">Must be registered with WhatsApp Business API</p>
                </div>

                <div className="space-y-4 pt-4 border-t border-navy/50">
                  {[
                    { label: 'Enable WhatsApp Alerts', desc: 'Send immediate messages for warning and critical events', checked: true },
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
                  <Button className="bg-amber hover:bg-amber/90 text-navy font-bold">
                    <Save className="w-4 h-4 mr-2" /> Save Notification Settings
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: PROFILE */}
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
                  <Input defaultValue="Factory Unit A" className="bg-[#0A0E1A] border-navy text-white" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Location</label>
                  <Input defaultValue="Sircilla, Telangana" className="bg-[#0A0E1A] border-navy text-white" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Total Monitored Machines</label>
                    <Input defaultValue="5" readOnly disabled className="bg-[#0A0E1A]/50 border-navy/50 text-slate-400 font-mono-data" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Shift Timings</label>
                    <select className="w-full bg-[#0A0E1A] border border-navy text-white rounded-md h-10 px-3 text-sm focus:ring-amber focus:border-amber outline-none">
                      <option>24x7 (3 Shifts)</option>
                      <option>16x7 (2 Shifts)</option>
                      <option>12x6 (1.5 Shifts)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-navy mt-8">
                  <Button className="bg-amber hover:bg-amber/90 text-navy font-bold">
                    <Save className="w-4 h-4 mr-2" /> Save Profile
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashLayout>
  );
}
