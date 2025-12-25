import React, { useState, useEffect, useMemo } from 'react';
import { Farmer, AppView, Cow, InseminationRecord } from './types';
import { db } from './services/db';
import { PullToRefresh } from './components/PullToRefresh';
import { getCattleAdvice } from './services/geminiService';

const App: React.FC = () => {
  const [user, setUser] = useState<Farmer | null>(null);
  const [view, setView] = useState<AppView>('dashboard');
  const [mobileInput, setMobileInput] = useState('');
  const [farmNameInput, setFarmNameInput] = useState('');
  
  // Data States
  const [cows, setCows] = useState<Cow[]>([]);
  const [inseminations, setInseminations] = useState<InseminationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [cowModalOpen, setCowModalOpen] = useState(false);
  const [insModalOpen, setInsModalOpen] = useState(false);
  const [editCow, setEditCow] = useState<Cow | null>(null);
  const [selectedCowId, setSelectedCowId] = useState<string>('');
  const [insSearch, setInsSearch] = useState('');

  // Filtering States for Inseminations
  const [isInsFilterVisible, setIsInsFilterVisible] = useState(false);
  const [insFilterStatus, setInsFilterStatus] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [insFilterStartDate, setInsFilterStartDate] = useState('');
  const [insFilterEndDate, setInsFilterEndDate] = useState('');

  // Assistant State
  const [assistantQuery, setAssistantQuery] = useState('');
  const [assistantResponse, setAssistantResponse] = useState('');
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);

  useEffect(() => {
    const loggedIn = db.getCurrentFarmer();
    if (loggedIn) {
      setUser(loggedIn);
      loadData(loggedIn.id);
    }
  }, []);

  const loadData = async (farmerId: string) => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setCows(db.getCows(farmerId));
    setInseminations(db.getInseminations(farmerId));
    setIsLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileInput || !farmNameInput) return;
    const newFarmer: Farmer = {
      id: Math.random().toString(36).substr(2, 9),
      mobile: mobileInput,
      farmName: farmNameInput
    };
    db.saveFarmer(newFarmer);
    setUser(newFarmer);
    loadData(newFarmer.id);
  };

  const handleLogout = () => {
    db.logout();
    setUser(null);
    setView('dashboard');
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleAddCow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const file = formData.get('image') as File;
    
    let imageUrl = editCow?.image || `https://picsum.photos/seed/${Math.random()}/300/200`;
    if (file && file.size > 0) {
      try {
        imageUrl = await fileToBase64(file);
      } catch (err) {
        console.error("Error converting image:", err);
      }
    }

    const cowData: Cow = {
      id: editCow ? editCow.id : Math.random().toString(36).substr(2, 9),
      farmerId: user.id,
      tagNumber: formData.get('tagNumber') as string,
      name: formData.get('name') as string,
      dob: formData.get('dob') as string,
      image: imageUrl
    };

    db.saveCow(cowData);
    setCows(db.getCows(user.id));
    setCowModalOpen(false);
    setEditCow(null);
  };

  const handleAddInsemination = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCowId) return;
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);

    const record: InseminationRecord = {
      id: Math.random().toString(36).substr(2, 9),
      farmerId: user.id,
      cowId: selectedCowId,
      date: formData.get('date') as string,
      doctorName: formData.get('doctorName') as string,
      bullName: formData.get('bullName') as string,
      isConfirmed: false,
      notes: formData.get('notes') as string
    };

    db.saveInsemination(record);
    setInseminations(db.getInseminations(user.id));
    setInsModalOpen(false);
    setSelectedCowId('');
    setInsSearch('');
  };

  const confirmInsemination = (id: string) => {
    const record = inseminations.find(i => i.id === id);
    if (record && user) {
      db.saveInsemination({ ...record, isConfirmed: true });
      setInseminations(db.getInseminations(user.id));
    }
  };

  const deleteInsemination = (id: string) => {
    if (user && window.confirm('Delete this record?')) {
      db.deleteInsemination(id);
      setInseminations(db.getInseminations(user.id));
    }
  };

  const resetFilters = () => {
    setInsFilterStatus('all');
    setInsFilterStartDate('');
    setInsFilterEndDate('');
  };

  const filteredInseminations = useMemo(() => {
    return inseminations.filter(i => {
      if (insFilterStatus === 'pending' && i.isConfirmed) return false;
      if (insFilterStatus === 'confirmed' && !i.isConfirmed) return false;

      const recordDate = new Date(i.date).getTime();
      if (insFilterStartDate) {
        const start = new Date(insFilterStartDate).getTime();
        if (recordDate < start) return false;
      }
      if (insFilterEndDate) {
        const end = new Date(insFilterEndDate).getTime();
        if (recordDate > end) return false;
      }

      return true;
    });
  }, [inseminations, insFilterStatus, insFilterStartDate, insFilterEndDate]);

  const pregnantCows = useMemo(() => {
    const pregnantCowIds = new Set(inseminations.filter(i => i.isConfirmed).map(i => i.cowId));
    return cows.filter(c => pregnantCowIds.has(c.id));
  }, [cows, inseminations]);

  const heatCheckReminders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return inseminations.filter(i => {
      if (i.isConfirmed) return false;
      const insDate = new Date(i.date);
      insDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - insDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      // Farmer specifically wants to know when 22 days have passed since insemination
      return diffDays >= 22;
    });
  }, [inseminations]);

  const askAssistant = async () => {
    if (!assistantQuery) return;
    setIsAssistantLoading(true);
    const response = await getCattleAdvice(cows, inseminations, assistantQuery);
    setAssistantResponse(response || '');
    setIsAssistantLoading(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
              <i className="fas fa-cow text-4xl text-emerald-600"></i>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center text-emerald-800 mb-2">CowManager</h1>
          <p className="text-gray-500 text-center mb-8">Manage your farm digitally</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
              <input type="tel" required className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none" placeholder="Enter 10 digit number" value={mobileInput} onChange={(e) => setMobileInput(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Farm Name</label>
              <input type="text" required className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none" placeholder="Enter your farm name" value={farmNameInput} onChange={(e) => setFarmNameInput(e.target.value)} />
            </div>
            <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg transition-all transform active:scale-95">Enter Farm</button>
          </form>
        </div>
      </div>
    );
  }

  const filteredCowsForIns = cows.filter(c => c.tagNumber.toLowerCase().includes(insSearch.toLowerCase()));

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col relative overflow-hidden">
      <header className="bg-emerald-600 p-6 text-white rounded-b-[2rem] shadow-lg sticky top-0 z-20">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider opacity-80">Welcome back,</h2>
            <h1 className="text-xl font-bold">{user.farmName}</h1>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-emerald-500 rounded-xl transition-colors">
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 overflow-hidden flex flex-col">
        {view === 'dashboard' && (
          <div className="space-y-6">
             <div className="grid grid-cols-2 gap-4">
               <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
                 <span className="text-3xl font-bold text-emerald-600">{cows.length}</span>
                 <span className="text-gray-500 text-sm">Total Cows</span>
               </div>
               <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
                 <span className="text-3xl font-bold text-pink-500">{pregnantCows.length}</span>
                 <span className="text-gray-500 text-sm">Pregnant</span>
               </div>
             </div>

             {heatCheckReminders.length > 0 && (
               <div className="bg-orange-50 p-4 rounded-3xl border border-orange-200 animate-pulse shadow-sm">
                 <div className="flex items-center mb-2">
                    <div className="w-8 h-8 bg-orange-200 rounded-full flex items-center justify-center text-orange-700 mr-2">
                      <i className="fas fa-bell"></i>
                    </div>
                    <h3 className="font-bold text-orange-800">Insemination Alert</h3>
                 </div>
                 <div className="space-y-2">
                    {heatCheckReminders.map(rem => {
                      const cow = cows.find(c => c.id === rem.cowId);
                      return (
                        <div key={rem.id} className="text-xs text-orange-700 bg-white/60 p-3 rounded-2xl flex flex-col space-y-2 border border-orange-100">
                          <p>The cow <strong className="text-orange-900">{cow?.name}</strong> has been completed 22 days inseminited confirm it.</p>
                          <button onClick={() => setView('insemination')} className="bg-orange-600 text-white py-2 px-4 rounded-xl font-bold text-[10px] self-start uppercase tracking-wider">Confirm Now</button>
                        </div>
                      )
                    })}
                 </div>
               </div>
             )}

             <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
               <h3 className="font-bold text-emerald-800 mb-2">Daily Tip</h3>
               <p className="text-emerald-700 text-sm leading-relaxed">
                 Check for signs of heat 22 days after insemination. Timely confirmation is key to productivity.
               </p>
             </div>

             <div className="space-y-4">
                <h3 className="font-bold text-gray-800">Recent Activity</h3>
                {inseminations.length === 0 ? (
                  <p className="text-gray-400 text-center py-4 italic">No recent records found</p>
                ) : (
                  inseminations.slice(0, 3).map(i => {
                    const cow = cows.find(c => c.id === i.cowId);
                    return (
                      <div key={i.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                            <i className="fas fa-syringe"></i>
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{cow?.name || 'Unknown Cow'}</p>
                            <p className="text-xs text-gray-500">{i.date}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${i.isConfirmed ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {i.isConfirmed ? 'Confirmed' : 'Pending'}
                        </span>
                      </div>
                    )
                  })
                )}
             </div>
          </div>
        )}

        {view === 'cows' && (
          <PullToRefresh onRefresh={() => loadData(user.id)}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Cows</h2>
              <button onClick={() => { setEditCow(null); setCowModalOpen(true); }} className="bg-emerald-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md hover:bg-emerald-700">
                <i className="fas fa-plus"></i>
              </button>
            </div>
            
            <div className="grid gap-4">
              {cows.length === 0 ? (
                <div className="text-center py-20">
                  <i className="fas fa-cow text-gray-200 text-6xl mb-4"></i>
                  <p className="text-gray-400">No cows added yet</p>
                </div>
              ) : (
                cows.map(cow => (
                  <div key={cow.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 group">
                    <img src={cow.image} alt={cow.name} className="w-full h-40 object-cover" />
                    <div className="p-4 flex justify-between items-end">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Tag #{cow.tagNumber}</span>
                        <h3 className="text-lg font-bold text-gray-800">{cow.name}</h3>
                        <p className="text-sm text-gray-500"><i className="fas fa-birthday-cake mr-2"></i>{cow.dob}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button onClick={() => { setEditCow(cow); setCowModalOpen(true); }} className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200"><i className="fas fa-edit text-xs"></i></button>
                        <button onClick={() => { if(window.confirm('Delete cow?')) { db.deleteCow(cow.id); setCows(db.getCows(user.id)); } }} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"><i className="fas fa-trash text-xs"></i></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="h-20" />
          </PullToRefresh>
        )}

        {view === 'insemination' && (
          <PullToRefresh onRefresh={() => loadData(user.id)}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Inseminations</h2>
              <div className="flex space-x-2">
                <button onClick={() => setIsInsFilterVisible(!isInsFilterVisible)} className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-colors ${isInsFilterVisible ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-gray-500 border border-gray-100'}`}><i className="fas fa-filter"></i></button>
                <button onClick={() => setInsModalOpen(true)} className="bg-emerald-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md hover:bg-emerald-700"><i className="fas fa-plus"></i></button>
              </div>
            </div>

            {isInsFilterVisible && (
              <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-6 space-y-4 animate-slide-up">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">From Date</label>
                    <input type="date" value={insFilterStartDate} onChange={(e) => setInsFilterStartDate(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">To Date</label>
                    <input type="date" value={insFilterEndDate} onChange={(e) => setInsFilterEndDate(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['all', 'pending', 'confirmed'].map((status) => (
                      <button key={status} onClick={() => setInsFilterStatus(status as any)} className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all capitalize ${insFilterStatus === status ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>{status}</button>
                    ))}
                  </div>
                </div>
                <button onClick={resetFilters} className="w-full py-2 text-xs font-bold text-gray-400 hover:text-emerald-600 transition-colors">Clear Filters</button>
              </div>
            )}

            <div className="space-y-4">
              {filteredInseminations.length === 0 ? (
                 <div className="text-center py-20"><i className="fas fa-search text-gray-200 text-6xl mb-4"></i><p className="text-gray-400">No records match your criteria</p></div>
              ) : (
                filteredInseminations.map(i => {
                  const cow = cows.find(c => c.id === i.cowId);
                  return (
                    <div key={i.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                      <div className="flex justify-between mb-2">
                        <div>
                          <p className="text-xs text-emerald-600 font-bold uppercase tracking-tight">Record #{i.id.slice(-4)}</p>
                          <h3 className="text-lg font-bold">{cow?.name || 'Deleted Cow'}</h3>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold self-start ${i.isConfirmed ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{i.isConfirmed ? 'Confirmed' : 'Pending'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-500 mb-4">
                        <div className="flex items-center"><i className="fas fa-calendar-alt mr-2 text-emerald-500 w-4"></i> {i.date}</div>
                        <div className="flex items-center"><i className="fas fa-user-md mr-2 text-emerald-500 w-4"></i> {i.doctorName || 'N/A'}</div>
                        <div className="flex items-center"><i className="fas fa-dna mr-2 text-emerald-500 w-4"></i> {i.bullName || 'N/A'}</div>
                        {cow && <div className="flex items-center"><i className="fas fa-tag mr-2 text-emerald-500 w-4"></i> {cow.tagNumber}</div>}
                      </div>
                      <div className="flex space-x-3">
                        {!i.isConfirmed && (
                          <button onClick={() => confirmInsemination(i.id)} className="flex-1 py-2 bg-emerald-50 text-emerald-600 font-bold rounded-xl border border-emerald-100 text-sm hover:bg-emerald-100">Confirm Success</button>
                        )}
                        <button onClick={() => deleteInsemination(i.id)} className="w-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100 hover:bg-red-100"><i className="fas fa-trash-alt"></i></button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div className="h-20" />
          </PullToRefresh>
        )}

        {view === 'pregnant' && (
          <PullToRefresh onRefresh={() => loadData(user.id)}>
             <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Pregnant Cows</h2>
              <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center shadow-sm"><i className="fas fa-heart"></i></div>
            </div>
            <div className="grid gap-4">
              {pregnantCows.length === 0 ? (
                <div className="text-center py-20"><div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><i className="fas fa-heart-broken text-gray-300 text-3xl"></i></div><p className="text-gray-400">No confirmed pregnancies yet.</p></div>
              ) : (
                pregnantCows.map(cow => {
                  const latestConfirmed = [...inseminations].filter(i => i.cowId === cow.id && i.isConfirmed).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                  return (
                    <div key={cow.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-pink-100 p-4">
                      <div className="flex items-center space-x-4">
                        <img src={cow.image} alt={cow.name} className="w-20 h-20 object-cover rounded-2xl" />
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-pink-500 uppercase">Confirmed Pregnant</span>
                          <h3 className="text-lg font-bold text-gray-800">{cow.name}</h3>
                          <p className="text-xs text-gray-500">Tag: {cow.tagNumber} | Date: {latestConfirmed?.date}</p>
                          <p className="mt-1 text-[10px] text-gray-400">Doctor: {latestConfirmed?.doctorName} | Bull: {latestConfirmed?.bullName}</p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div className="h-20" />
          </PullToRefresh>
        )}

        {view === 'assistant' && (
          <div className="flex flex-col h-full">
            <h2 className="text-xl font-bold text-gray-800 mb-4">AI Consultant</h2>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {assistantResponse ? (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 leading-relaxed text-gray-700 whitespace-pre-wrap"><div className="font-bold text-emerald-600 mb-2">Advice:</div>{assistantResponse}</div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-300"><i className="fas fa-comment-medical text-6xl mb-4"></i><p>Ask a question below</p></div>
              )}
              {isAssistantLoading && <div className="flex justify-center py-4"><div className="animate-bounce p-2 bg-emerald-100 rounded-full text-emerald-600"><i className="fas fa-ellipsis-h"></i></div></div>}
            </div>
            <div className="flex space-x-2 bg-white p-2 rounded-2xl border border-gray-100 shadow-lg">
              <input type="text" className="flex-1 bg-transparent px-4 py-2 outline-none text-sm" placeholder="Ask about your herd..." value={assistantQuery} onChange={(e) => setAssistantQuery(e.target.value)} />
              <button onClick={askAssistant} disabled={isAssistantLoading} className="bg-emerald-600 text-white w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-50"><i className="fas fa-paper-plane"></i></button>
            </div>
          </div>
        )}
      </main>

      <nav className="bg-white border-t border-gray-100 p-4 sticky bottom-0 z-30 rounded-t-[2.5rem] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center px-2">
          <button onClick={() => setView('dashboard')} className={`flex flex-col items-center transition-all ${view === 'dashboard' ? 'text-emerald-600' : 'text-gray-400'}`}><i className={`fas fa-home ${view === 'dashboard' ? 'scale-110' : ''}`}></i><span className="text-[10px] mt-1 font-bold">Home</span></button>
          <button onClick={() => setView('cows')} className={`flex flex-col items-center transition-all ${view === 'cows' ? 'text-emerald-600' : 'text-gray-400'}`}><i className={`fas fa-cow ${view === 'cows' ? 'scale-110' : ''}`}></i><span className="text-[10px] mt-1 font-bold">Cow</span></button>
          <button onClick={() => setView('insemination')} className={`flex flex-col items-center transition-all ${view === 'insemination' ? 'text-emerald-600' : 'text-gray-400'}`}><i className={`fas fa-syringe ${view === 'insemination' ? 'scale-110' : ''}`}></i><span className="text-[10px] mt-1 font-bold">Ins.</span></button>
          <button onClick={() => setView('pregnant')} className={`flex flex-col items-center transition-all ${view === 'pregnant' ? 'text-emerald-600' : 'text-gray-400'}`}><i className={`fas fa-heart ${view === 'pregnant' ? 'scale-110 text-pink-500' : ''}`}></i><span className="text-[10px] mt-1 font-bold">Preg.</span></button>
          <button onClick={() => setView('assistant')} className={`flex flex-col items-center transition-all ${view === 'assistant' ? 'text-emerald-600' : 'text-gray-400'}`}><i className={`fas fa-magic ${view === 'assistant' ? 'scale-110' : ''}`}></i><span className="text-[10px] mt-1 font-bold">AI</span></button>
        </div>
      </nav>

      {cowModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl animate-slide-up overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-bold text-gray-800">{editCow ? 'Edit Cow' : 'New Cow'}</h3><button onClick={() => setCowModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl"><i className="fas fa-times"></i></button></div>
            <form onSubmit={handleAddCow} className="space-y-4">
              <input name="tagNumber" defaultValue={editCow?.tagNumber} required type="text" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Tag Number" />
              <input name="name" defaultValue={editCow?.name} required type="text" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Cow Name" />
              <input name="dob" defaultValue={editCow?.dob} required type="date" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" />
              <input name="image" type="file" accept="image/*" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none" />
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg mt-4">Save Cow</button>
            </form>
          </div>
        </div>
      )}

      {insModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl animate-slide-up overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-bold text-gray-800">New Insemination</h3><button onClick={() => setInsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl"><i className="fas fa-times"></i></button></div>
            <div className="mb-4">
              <input type="text" className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Search Tag..." value={insSearch} onChange={(e) => setInsSearch(e.target.value)} />
              <div className="max-h-40 overflow-y-auto mt-2 space-y-2">
                {filteredCowsForIns.map(c => (
                  <button key={c.id} onClick={() => setSelectedCowId(c.id)} className={`w-full text-left p-3 rounded-xl border ${selectedCowId === c.id ? 'bg-emerald-100 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}><span className="font-bold">{c.name}</span> (Tag: {c.tagNumber})</button>
                ))}
              </div>
            </div>
            {selectedCowId && (
              <form onSubmit={handleAddInsemination} className="space-y-4">
                <input name="date" required type="date" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" />
                <div className="grid grid-cols-2 gap-3">
                  <input name="doctorName" required type="text" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none" placeholder="Doctor Name" />
                  <input name="bullName" required type="text" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none" placeholder="Bull ID/Name" />
                </div>
                <input name="notes" type="text" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none" placeholder="Notes (Optional)" />
                <button type="submit" className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg mt-4">Save Record</button>
              </form>
            )}
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default App;