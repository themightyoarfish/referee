import { Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import { socket } from './socket';
import AdminAuthProvider, { useAdminAuth } from './context/AdminAuthContext';

import Home from './pages/Home';
import Display from './pages/Display';
import Countdown from './pages/Countdown';
import Attempt from './pages/Attempt';
import Settings from './pages/Settings';
import Ref from './pages/Ref';
import Login from './pages/Login';

type CompData = {
  weight: string;
  discipline: string;
  attempt: string;
  competitionAthlete: {
    firstName: string;
    lastName: string;
    team: string;
    bodyWeightCategory: {
      name: string;
    };
    club: {
      name: string;
    };
    ageCategory: {
      name: string;
    };
  };
};

type JudgeLinks = Partial<Record<RatingKeys, string>>;

const PUBLIC_PATHS = new Set([
  '/ref',
  '/display',
  '/countdown',
  '/versuch',
  '/login',
]);

function AppContent() {
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [ip, setIp] = useState<string | null>(null);
  const [rating, setRating] = useState<RatingObject>(null);
  const [settings, setSettings] = useState<SettingsObject>(null);
  const [competitionData, setCompetitionData] = useState<CompData[]>([]);
  const [judgeLinks, setJudgeLinks] = useState<JudgeLinks | null>(null);

  const location = useLocation();
  const { checked, isAdmin } = useAdminAuth();

  useEffect(() => {
    isConnected && socket.emit('users', { user: location?.pathname });
  }, [location, isConnected]);

  useEffect(() => {
    function onConnect(): void {
      setIsConnected(true);
      socket.emit('getIp');
      socket.emit('getJudgeLinks');
    }

    function onDisconnect(): void {
      setIsConnected(false);
    }

    function getIp(value: string): void {
      setIp(value);
    }

    function getRating(value: RatingObject): void {
      setRating(value);
    }

    function getSettings(value: SettingsObject): void {
      setSettings(value);
    }

    function getCompetitionData(value: CompData[]): void {
      setCompetitionData(value);
    }

    function onJudgeLinks(value: JudgeLinks): void {
      setJudgeLinks(value);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('ip', getIp);
    socket.on('rating', getRating);
    socket.on('settings', getSettings);
    socket.on('intervall', getCompetitionData);
    socket.on('judgeLinks', onJudgeLinks);

    if (socket.connected) {
      socket.emit('getIp');
      socket.emit('getJudgeLinks');
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('ip', getIp);
      socket.off('rating', getRating);
      socket.off('settings', getSettings);
      socket.off('intervall', getCompetitionData);
      socket.off('judgeLinks', onJudgeLinks);
    };
  }, []);

  const isPublicRoute = PUBLIC_PATHS.has(location.pathname);

  if (!checked) {
    return (
      <div className='min-h-screen bg-gray-200 flex items-center justify-center'>
        <span className='loading loading-spinner loading-lg'></span>
      </div>
    );
  }

  if (isPublicRoute) {
    return (
      <div className='min-h-screen bg-gray-200'>
        {!['/display', '/countdown', '/versuch', '/ref'].includes(
          location.pathname
        ) && <Navbar location={location} settings={settings} />}
        <Routes>
          <Route
            path='/ref'
            element={
              <Ref
                rating={rating}
                isConnected={isConnected}
                settings={settings}
              />
            }
          />
          <Route
            path='/display'
            element={
              <Display
                isConnected={isConnected}
                rating={rating}
                ip={ip}
                settings={settings}
                competitionData={competitionData}
                judgeLinks={judgeLinks}
              />
            }
          />
          <Route
            path='/countdown'
            element={<Countdown isConnected={isConnected} rating={rating} />}
          />
          <Route
            path='/versuch'
            element={
              <Attempt rating={rating} competitionData={competitionData} />
            }
          />
          <Route path='/login' element={<Login />} />
        </Routes>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className='min-h-screen bg-gray-200'>
        <Routes>
          <Route path='/login' element={<Login />} />
          <Route path='*' element={<Navigate to='/login' replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-200'>
      <Navbar location={location} settings={settings} />
      <Routes>
        <Route
          path='/'
          element={
            <Home
              ip={ip}
              isConnected={isConnected}
              compData={competitionData}
            />
          }
        />
        <Route
          path='/display'
          element={
            <Display
              isConnected={isConnected}
              rating={rating}
              ip={ip}
              settings={settings}
              competitionData={competitionData}
              judgeLinks={judgeLinks}
            />
          }
        />
        <Route
          path='/countdown'
          element={<Countdown isConnected={isConnected} rating={rating} />}
        />
        <Route
          path='/versuch'
          element={
            <Attempt rating={rating} competitionData={competitionData} />
          }
        />
        <Route
          path='/settings'
          element={<Settings ip={ip} settings={settings} />}
        />
        <Route
          path='/ref'
          element={
            <Ref
              rating={rating}
              isConnected={isConnected}
              settings={settings}
            />
          }
        />
        <Route path='/login' element={<Navigate to='/' replace />} />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AdminAuthProvider>
      <AppContent />
    </AdminAuthProvider>
  );
}

export default App;
