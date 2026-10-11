import { useEffect, useState } from 'react';

type Candidate = {
  address: string;
  interface: string;
  label: string;
  display: string;
};

type Props = {
  accessToken: string | null;
};

function SettingsHostCard({ accessToken }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [current, setCurrent] = useState<string>('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/settings/host', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setCandidates(data.candidates || []);
        const ip = data.selected?.hostIp || '';
        setCurrent(ip);
        setSelected(ip);
      })
      .catch(() => setMsg('Adressen konnten nicht geladen werden.'));
  }, [accessToken]);

  async function apply() {
    if (!accessToken || !selected) return;
    setMsg('');
    const res = await fetch('/api/settings/host', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ hostIp: selected }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.msg || 'Fehler');
      return;
    }
    setCurrent(data.selected?.hostIp || selected);
    setMsg('Adresse aktualisiert. QR-Codes nutzen die neue URL.');
  }

  return (
    <div className='card bg-base-100 shadow-xl'>
      <div className='card-body'>
        <span className='text-xl font-semibold'>Adresse für QR-Codes</span>
        <p className='text-sm opacity-80'>
          Aktuell: {current || '—'}. Gilt bis der Server neu gestartet wird.
        </p>
        <select
          className='select select-bordered w-full max-w-md'
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value='' disabled>Wählen…</option>
          {candidates.map((c) => (
            <option key={`${c.interface}-${c.address}`} value={c.address}>
              {c.display}
            </option>
          ))}
        </select>
        <button type='button' className='btn btn-primary w-fit' onClick={apply}>
          Übernehmen
        </button>
        {msg && <p className='text-sm'>{msg}</p>}
      </div>
    </div>
  );
}

export default SettingsHostCard;
