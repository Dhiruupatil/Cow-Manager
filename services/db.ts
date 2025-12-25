
import { Farmer, Cow, InseminationRecord } from '../types';

const STORAGE_KEYS = {
  FARMERS: 'cowmanager_farmers',
  COWS: 'cowmanager_cows',
  INSEMINATIONS: 'cowmanager_inseminations',
  CURRENT_USER: 'cowmanager_current_user'
};

export const db = {
  // Auth
  saveFarmer: (farmer: Farmer) => {
    const farmers = db.getFarmers();
    const existing = farmers.find(f => f.mobile === farmer.mobile);
    if (!existing) {
      farmers.push(farmer);
      localStorage.setItem(STORAGE_KEYS.FARMERS, JSON.stringify(farmers));
    }
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(farmer));
  },
  getCurrentFarmer: (): Farmer | null => {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },
  getFarmers: (): Farmer[] => {
    const data = localStorage.getItem(STORAGE_KEYS.FARMERS);
    return data ? JSON.parse(data) : [];
  },

  // Cows
  getCows: (farmerId: string): Cow[] => {
    const data = localStorage.getItem(STORAGE_KEYS.COWS);
    const allCows: Cow[] = data ? JSON.parse(data) : [];
    return allCows.filter(c => c.farmerId === farmerId);
  },
  saveCow: (cow: Cow) => {
    const allCows = JSON.parse(localStorage.getItem(STORAGE_KEYS.COWS) || '[]');
    const index = allCows.findIndex((c: Cow) => c.id === cow.id);
    if (index > -1) {
      allCows[index] = cow;
    } else {
      allCows.push(cow);
    }
    localStorage.setItem(STORAGE_KEYS.COWS, JSON.stringify(allCows));
  },
  deleteCow: (id: string) => {
    const allCows = JSON.parse(localStorage.getItem(STORAGE_KEYS.COWS) || '[]');
    const filtered = allCows.filter((c: Cow) => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.COWS, JSON.stringify(filtered));
    
    // Also delete associated insemination records
    const allIns = JSON.parse(localStorage.getItem(STORAGE_KEYS.INSEMINATIONS) || '[]');
    const filteredIns = allIns.filter((i: InseminationRecord) => i.cowId !== id);
    localStorage.setItem(STORAGE_KEYS.INSEMINATIONS, JSON.stringify(filteredIns));
  },

  // Insemination
  getInseminations: (farmerId: string): InseminationRecord[] => {
    const data = localStorage.getItem(STORAGE_KEYS.INSEMINATIONS);
    const all: InseminationRecord[] = data ? JSON.parse(data) : [];
    return all.filter(i => i.farmerId === farmerId);
  },
  saveInsemination: (record: InseminationRecord) => {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.INSEMINATIONS) || '[]');
    const index = all.findIndex((i: InseminationRecord) => i.id === record.id);
    if (index > -1) {
      all[index] = record;
    } else {
      all.push(record);
    }
    localStorage.setItem(STORAGE_KEYS.INSEMINATIONS, JSON.stringify(all));
  },
  deleteInsemination: (id: string) => {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.INSEMINATIONS) || '[]');
    const filtered = all.filter((i: InseminationRecord) => i.id !== id);
    localStorage.setItem(STORAGE_KEYS.INSEMINATIONS, JSON.stringify(filtered));
  }
};
