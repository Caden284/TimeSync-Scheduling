'use client';

import { useState } from 'react';
import { Modal, inputCls, labelCls } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { createLocation } from '@/lib/db';

interface Props { onClose: () => void; onSaved: (loc: any) => void; }

export function AddLocationModal({ onClose, onSaved }: Props) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', city: '', state: '', address: '' });
  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSave() {
    if (!form.name) { setError('Location name is required.'); return; }
    setSaving(true); setError('');
    try {
      const doc = await createLocation(profile?.orgId ?? 'local', { name: form.name, city: form.city, state: form.state });
      onSaved({ id: doc.$id, ...form });
      onClose();
    } catch (e: any) { setError(e?.message ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Add Location" onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" leftIcon={<MapPin size={13} />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Add Location'}
        </Button>
      </>}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div><label className={labelCls}>Location Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Main Branch" className={inputCls} autoFocus /></div>
        <div><label className={labelCls}>Street Address</label>
          <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St" className={inputCls} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>City</label>
            <input value={form.city} onChange={e => set('city', e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>State</label>
            <input value={form.state} onChange={e => set('state', e.target.value)} placeholder="GA" className={inputCls} /></div>
        </div>
      </div>
    </Modal>
  );
}
