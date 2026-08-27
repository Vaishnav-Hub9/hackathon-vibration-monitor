import { Languages } from 'lucide-react';
import { useI18n, type Language } from '@/i18n';

const OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'te', label: 'తెలుగు' },
  { value: 'ta', label: 'தமிழ்' },
];

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();
  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-navy bg-[#141E35] px-2.5 py-1.5 text-[10px] text-slate-400" title={t('language')}>
      <Languages className="h-3.5 w-3.5 text-amber" />
      <span className="hidden sm:inline">{t('language')}</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={t('language')} className="bg-transparent text-[10px] font-bold text-slate-200 outline-none">
        {OPTIONS.map((option) => <option key={option.value} value={option.value} className="bg-[#0F1629] text-white">{option.label}</option>)}
      </select>
    </label>
  );
}
