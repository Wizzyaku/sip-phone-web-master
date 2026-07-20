import { useState, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Phone,
  MessageSquare,
  UserPlus,
  X,
  Star,
  Building2,
  Mail,
  Camera,
  Loader2,
  Check,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { cn } from '../lib/utils';
import { useIsDesktop } from '../hooks/useIsDesktop';

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string;
  number: string;
  phoneType: string;
  initials: string;
  avatarColor: string;
  favorite?: boolean;
  online?: boolean;
}

const initialContacts: Contact[] = [
  { id: '1', name: 'Aria Martinez', email: 'aria.m@europe.com', company: 'Europe', number: '+44 20 7946 0958', phoneType: 'Mobile', initials: 'AM', avatarColor: 'bg-purple-50 text-purple-600 border-purple-100' },
  { id: '2', name: 'Elena Rodriguez', email: 'elena.r@techflow.io', company: 'TechFlow Systems', number: '+1 (555) 012-3456', phoneType: 'Mobile', initials: 'ER', avatarColor: 'bg-indigo-50 text-indigo-600 border-indigo-100', online: true },
  { id: '3', name: 'Marcus Thorne', email: 'm.thorne@glocapital.com', company: 'Global Capital Partners', number: '+44 20 7946 0123', phoneType: 'Office', initials: 'MT', avatarColor: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  { id: '4', name: 'Sarah Jenkins', email: 'sarah.j@pixelperfect.design', company: 'PixelPerfect Design', number: '+1 (555) 987-6543', phoneType: 'Personal', initials: 'SJ', avatarColor: 'bg-amber-50 text-amber-600 border-amber-100', favorite: true },
  { id: '5', name: 'Alice Johnson', email: 'alice@example.com', company: 'Acme Corp', number: '+1 (555) 123-4567', phoneType: 'Mobile', initials: 'AJ', avatarColor: 'bg-blue-50 text-blue-600 border-blue-100' },
  { id: '6', name: 'Bob Smith', email: 'bob@example.com', company: 'Smith Logistics', number: '+1 (555) 234-5678', phoneType: 'Office', initials: 'BS', avatarColor: 'bg-orange-50 text-orange-600 border-orange-100' },
  { id: '7', name: 'Carol White', email: 'carol@example.com', company: 'White & Co', number: '+1 (555) 345-6789', phoneType: 'Mobile', initials: 'CW', avatarColor: 'bg-pink-50 text-pink-600 border-pink-100', favorite: true },
  { id: '8', name: 'David Lee', email: 'david@example.com', company: 'NextGen Labs', number: '+1 (555) 456-7890', phoneType: 'Office', initials: 'DL', avatarColor: 'bg-teal-50 text-teal-600 border-teal-100' },
  { id: '9', name: 'Jordan Davids', email: 'jordan@davids.com', company: 'Freelance', number: '+1 (555) 012-3456', phoneType: 'Mobile', initials: 'JD', avatarColor: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
];

type FilterTab = 'all' | 'favorites' | 'recent';

export function Contacts() {
  const [query, setQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [addContactModal, setAddContactModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', phone: '', email: '', company: '' });
  const [contacts, setContacts] = useState(initialContacts);
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const setActiveConversation = useAppStore((s) => s.setActiveConversation);
  const conversations = useAppStore((s) => s.conversations);

  const filtered = useMemo(() => {
    let result = contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.number.includes(query) ||
        c.email.toLowerCase().includes(query.toLowerCase()) ||
        c.company.toLowerCase().includes(query.toLowerCase())
    );
    if (filterTab === 'favorites') result = result.filter((c) => c.favorite);
    return result;
  }, [query, contacts, filterTab]);

  const grouped = useMemo(() => {
    const groups: Record<string, Contact[]> = {};
    filtered.forEach((c) => {
      const letter = c.name[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(c);
    });
    return Object.keys(groups).sort().reduce((acc, key) => {
      acc[key] = groups[key];
      return acc;
    }, {} as Record<string, Contact[]>);
  }, [filtered]);

  const handleStartChat = (number: string) => {
    const existing = conversations.find((c) => c.contact === number);
    if (existing) {
      setActiveConversation(existing.id);
    } else {
      setActiveConversation(number);
    }
    navigate('/messages');
  };

  const handleCall = (number: string) => {
    navigate('/calls', { state: { dialNumber: number } });
  };

  const handleSaveContact = () => {
    setSaving(true);
    setTimeout(() => {
      const name = `${newContact.firstName} ${newContact.lastName}`.trim();
      const initials = `${newContact.firstName[0] ?? ''}${newContact.lastName[0] ?? ''}`.toUpperCase();
      const colors = ['bg-indigo-50 text-indigo-600 border-indigo-100', 'bg-purple-50 text-purple-600 border-purple-100', 'bg-emerald-50 text-emerald-600 border-emerald-100', 'bg-amber-50 text-amber-600 border-amber-100', 'bg-blue-50 text-blue-600 border-blue-100'];
      const newEntry: Contact = {
        id: Date.now().toString(),
        name: name || 'Unknown',
        email: newContact.email,
        company: newContact.company,
        number: newContact.phone,
        phoneType: 'Mobile',
        initials: initials || 'UN',
        avatarColor: colors[Math.floor(Math.random() * colors.length)],
      };
      setContacts((prev) => [...prev, newEntry]);
      setSaving(false);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setAddContactModal(false);
        setNewContact({ firstName: '', lastName: '', phone: '', email: '', company: '' });
      }, 1000);
    }, 1200);
  };

  return (
    <div className="relative h-[calc(100vh-154px)] w-full min-w-0 overflow-hidden bg-background md:h-[calc(100vh-7.5rem)] md:rounded-2xl md:border md:border-border/30">
      {/* MOBILE VIEW */}
      {!isDesktop && (
        <div className="absolute inset-0 flex flex-col bg-[#F0F4F8] dark:bg-slate-950">
          <header className="shrink-0 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 pt-4 pb-3 px-4 flex items-center justify-between z-20 dark:bg-slate-900/90 dark:border-slate-700/50">
            <h1 className="text-[15px] font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Contacts</h1>
            <button onClick={() => setAddContactModal(true)} className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 active:scale-95 transition-transform shadow-sm dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400">
              <UserPlus className="w-4 h-4" />
            </button>
          </header>
          <div className="flex-grow overflow-y-auto no-scrollbar px-4 pt-3 pb-[10px] flex flex-col gap-3.5 z-10">
            <div className="animate-fade-in shrink-0 flex flex-col gap-3">
              <div className="relative w-full shadow-[0_2px_8px_rgba(15,23,42,0.02)]">
                <Search className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none w-[18px] h-[18px]" />
                <input type="text" placeholder="Search names, companies, or numbers..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full h-11 bg-white border border-slate-200 rounded-[14px] pl-10 pr-3 text-[13px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button onClick={() => setFilterTab('all')} className={cn('px-4 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap shadow-sm transition-all active:scale-95', filterTab === 'all' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300')}>All Contacts</button>
                <button onClick={() => setFilterTab('favorites')} className={cn('px-4 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap shadow-sm transition-all active:scale-95 flex items-center gap-1', filterTab === 'favorites' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300')}>
                  <Star className={cn('w-3.5 h-3.5', filterTab === 'favorites' ? 'text-amber-400 fill-amber-400' : 'text-amber-500 fill-amber-500')} /> Favorites
                </button>
                <button onClick={() => setFilterTab('recent')} className={cn('px-4 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap shadow-sm transition-all active:scale-95', filterTab === 'recent' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300')}>Recent</button>
              </div>
            </div>

            {/* Mobile Contacts List */}
            <div className="animate-fade-in animate-delay-100 shrink-0 flex flex-col gap-4 mt-1">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3 dark:bg-slate-800">
                    <UserPlus className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-[14px] font-bold text-slate-500 dark:text-slate-400">No contacts found</p>
                  <p className="text-[12px] text-slate-400 mt-1 dark:text-slate-500">Try adjusting your search or add a new contact.</p>
                </div>
              ) : (
                Object.entries(grouped).map(([letter, items]) => (
                  <div key={letter} className="flex flex-row items-start gap-2.5 min-w-0">
                    <h3 className="text-[14px] font-extrabold text-slate-400 sticky top-1 bg-[#F0F4F8]/90 backdrop-blur-sm z-10 py-1 rounded-full w-7 h-7 flex items-center justify-center shrink-0 dark:bg-slate-950/90 dark:text-slate-500">{letter}</h3>
                    <div className="flex-1 min-w-0 bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-3 flex flex-col divide-y divide-slate-50 dark:bg-slate-900 dark:border-slate-700/50 dark:divide-slate-700/30">
                      {items.map((contact) => (
                        <div key={contact.id} className="py-2.5 flex items-center justify-between group active:bg-slate-50 transition-colors cursor-pointer rounded-[14px] px-1 dark:active:bg-slate-800">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn('w-11 h-11 rounded-full font-extrabold text-[14px] flex items-center justify-center shrink-0 border', contact.avatarColor, 'dark:border-slate-700')}>{contact.initials}</div>
                            <div className="flex flex-col min-w-0">
                              <h4 className="text-[14px] font-extrabold text-slate-800 truncate leading-tight flex items-center gap-1 dark:text-slate-100">
                                {contact.name}
                                {contact.favorite && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                              </h4>
                              <span className="text-[11px] font-semibold text-slate-500 truncate mt-0.5 dark:text-slate-400">{contact.number} {contact.company && `\u2022 ${contact.company}`}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2">
                            <button onClick={() => handleCall(contact.number)} className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors active:scale-95 dark:bg-indigo-900/30 dark:text-indigo-400"><Phone className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleStartChat(contact.number)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors active:scale-95 dark:bg-slate-700 dark:text-slate-300"><MessageSquare className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {filtered.length > 0 && <div className="text-center mt-2 opacity-50"><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">End of contacts</span></div>}
            </div>
          </div>
          <button onClick={() => setAddContactModal(true)} className="absolute bottom-[10px] right-5 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[18px] flex items-center justify-center shadow-[0_8px_25px_rgba(79,70,229,0.4)] z-40 active:scale-90 transition-transform">
            <UserPlus className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* DESKTOP VIEW */}
      {isDesktop && (
        <div className="hidden lg:block h-full overflow-y-auto no-scrollbar bg-[#F0F4F8] dark:bg-slate-950">
          <div className="p-8 pb-8 flex flex-col gap-5 max-w-[1200px] mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[24px] font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Contacts Directory</h1>
                <p className="text-[13px] font-medium text-slate-500 mt-0.5 dark:text-slate-400">Manage your organization's relationships and communication history.</p>
              </div>
              <button onClick={() => setAddContactModal(true)} className="h-10 px-4 bg-indigo-600 text-white rounded-[12px] text-[13px] font-bold flex items-center gap-2 active:scale-95 transition-transform shadow-[0_4px_15px_rgba(79,70,229,0.3)] hover:bg-indigo-500">
                <UserPlus className="w-4 h-4" /> Add Contact
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none w-[18px] h-[18px]" />
                <input type="text" placeholder="Search names, companies, or numbers..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full h-11 bg-white border border-slate-200 rounded-[14px] pl-10 pr-3 text-[13px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setFilterTab('all')} className={cn('px-4 py-2 rounded-full text-[12px] font-bold whitespace-nowrap shadow-sm transition-all', filterTab === 'all' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300')}>All Contacts</button>
                <button onClick={() => setFilterTab('favorites')} className={cn('px-4 py-2 rounded-full text-[12px] font-bold whitespace-nowrap shadow-sm transition-all flex items-center gap-1', filterTab === 'favorites' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300')}>
                  <Star className={cn('w-3.5 h-3.5', filterTab === 'favorites' ? 'text-amber-400 fill-amber-400' : 'text-amber-500 fill-amber-500')} /> Favorites
                </button>
                <button onClick={() => setFilterTab('recent')} className={cn('px-4 py-2 rounded-full text-[12px] font-bold whitespace-nowrap shadow-sm transition-all', filterTab === 'recent' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300')}>Recent</button>
              </div>
              <span className="text-[12px] font-medium text-slate-500 ml-auto dark:text-slate-400">{filtered.length} contacts found</span>
            </div>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4 dark:bg-slate-800">
                  <UserPlus className="w-9 h-9 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-[16px] font-bold text-slate-500 dark:text-slate-400">No contacts found</p>
                <p className="text-[13px] text-slate-400 mt-1 dark:text-slate-500">Try adjusting your search or add a new contact.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(grouped).map(([letter, items]) => (
                  <div key={letter} className="flex flex-row items-start gap-2.5 min-w-0">
                    <h3 className="text-[14px] font-extrabold text-slate-400 w-7 h-7 flex items-center justify-center shrink-0 dark:text-slate-500">{letter}</h3>
                    <div className="flex-1 min-w-0 bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-3 flex flex-col divide-y divide-slate-50 dark:bg-slate-900 dark:border-slate-700/50 dark:divide-slate-700/30">
                      {items.map((contact) => (
                        <div key={contact.id} className="py-2.5 flex items-center justify-between group hover:bg-slate-50 transition-colors cursor-pointer rounded-[14px] px-1 dark:hover:bg-slate-800">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn('w-11 h-11 rounded-full font-extrabold text-[14px] flex items-center justify-center shrink-0 border', contact.avatarColor, 'dark:border-slate-700')}>{contact.initials}</div>
                            <div className="flex flex-col min-w-0">
                              <h4 className="text-[14px] font-extrabold text-slate-800 truncate leading-tight flex items-center gap-1 dark:text-slate-100">
                                {contact.name}
                                {contact.favorite && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                              </h4>
                              <span className="text-[11px] font-semibold text-slate-500 truncate mt-0.5 dark:text-slate-400">{contact.number} {contact.company && `\u2022 ${contact.company}`}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2">
                            <button onClick={() => handleCall(contact.number)} className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors active:scale-95 dark:bg-indigo-900/30 dark:text-indigo-400"><Phone className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleStartChat(contact.number)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors active:scale-95 dark:bg-slate-700 dark:text-slate-300"><MessageSquare className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD CONTACT MODAL */}
      {addContactModal && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => !saving && !saved && setAddContactModal(false)} />
          <div className="relative flex w-full flex-col rounded-t-[32px] bg-white shadow-[0_-15px_40px_rgba(0,0,0,0.2)] transition-transform dark:bg-slate-900 max-h-[90dvh] max-w-[430px] mx-auto">
            <div className="shrink-0 pt-3 pb-3 px-5 border-b border-slate-100 flex flex-col items-center relative dark:border-slate-700/50">
              <div className="w-10 h-1.5 bg-slate-200 rounded-full mb-3 dark:bg-slate-700" />
              <h2 className="text-[16px] font-extrabold text-slate-800 tracking-tight dark:text-slate-100">New Contact</h2>
              <button onClick={() => !saving && !saved && setAddContactModal(false)} className="absolute top-4 right-4 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-500 active:scale-95 transition-transform dark:bg-slate-800 dark:text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-grow overflow-y-auto no-scrollbar px-5 py-4 flex flex-col gap-4">
              <div className="flex justify-center mb-1">
                <div className="w-20 h-20 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-100 transition-colors dark:bg-slate-800 dark:border-slate-600 dark:text-slate-500">
                  <Camera className="w-6 h-6" />
                  <span className="text-[9px] font-bold mt-1">Add Photo</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">First Name</label>
                    <input type="text" placeholder="John" value={newContact.firstName} onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })} className="w-full h-12 bg-slate-50 border border-slate-200 rounded-[14px] px-4 text-[14px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Last Name</label>
                    <input type="text" placeholder="Doe" value={newContact.lastName} onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })} className="w-full h-12 bg-slate-50 border border-slate-200 rounded-[14px] px-4 text-[14px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Phone Number</label>
                  <div className="relative w-full">
                    <Phone className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none w-[18px] h-[18px]" />
                    <input type="tel" placeholder="+1 (555) 000-0000" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} className="w-full h-12 bg-slate-50 border border-slate-200 rounded-[14px] pl-10 pr-4 text-[14px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Email Address (Optional)</label>
                  <div className="relative w-full">
                    <Mail className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none w-[18px] h-[18px]" />
                    <input type="email" placeholder="john.doe@example.com" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} className="w-full h-12 bg-slate-50 border border-slate-200 rounded-[14px] pl-10 pr-4 text-[14px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Company / Notes</label>
                  <div className="relative w-full">
                    <Building2 className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none w-[18px] h-[18px]" />
                    <input type="text" placeholder="Acme Corp..." value={newContact.company} onChange={(e) => setNewContact({ ...newContact, company: e.target.value })} className="w-full h-12 bg-slate-50 border border-slate-200 rounded-[14px] pl-10 pr-4 text-[14px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                  </div>
                </div>
              </div>
              <div className="pt-4 mt-2 pb-6">
                <button onClick={handleSaveContact} disabled={saving || saved || !newContact.firstName.trim() || !newContact.phone.trim()} className={cn('w-full h-12 rounded-[16px] text-[14px] font-extrabold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50', saved ? 'bg-emerald-500 text-white shadow-[0_8px_20px_rgba(16,185,129,0.3)]' : 'bg-indigo-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)]')}>
                  {saving ? (<><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>) : saved ? (<><Check className="w-4 h-4" /> Saved Successfully</>) : 'Save Contact'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(Contacts);
