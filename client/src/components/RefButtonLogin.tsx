import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useSubmit from '../hooks/useSubmit';
import { socket } from '../socket';

type RefButtonLoginProps = {
  setToken: React.Dispatch<React.SetStateAction<string | null>>;
  token: string | null;
  setRef: React.Dispatch<React.SetStateAction<RefObject | null>>;
};

const JUDGE_POSITIONS = new Set(['left', 'main', 'right']);

/** Survives Strict Mode remounts so QR / stored-token auto-login runs once per token. */
const autoLoginAttempted = new Set<string>();

function RefButtonLogin({ setToken, token, setRef }: RefButtonLoginProps) {
  const { loading, error, success, fetchData } = useSubmit();
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const loginInFlight = useRef(false);

  useEffect(() => {
    function onRegisterFailed(payload: { msg?: string }) {
      setSessionError(payload?.msg || 'Verbindung abgelehnt');
      setRef(null);
      localStorage.removeItem('refToken');
    }

    socket.on('refRegisterFailed', onRegisterFailed);
    return () => {
      socket.off('refRegisterFailed', onRegisterFailed);
    };
  }, [setRef]);

  const handleSubmit = useCallback(
    async (refToken: string | null): Promise<void> => {
      if (!refToken || loginInFlight.current) return;
      loginInFlight.current = true;
      try {
        const data: any = await fetchData(
          '/auth/ref',
          'POST',
          { token: refToken },
          null,
          refToken
        );
        if (data) {
          setSessionError(null);
          setRef(data);
          localStorage.setItem('refToken', refToken);
          if (JUDGE_POSITIONS.has(data.position)) {
            socket.emit('refRegister', { token: refToken });
          }
        } else {
          localStorage.removeItem('refToken');
          autoLoginAttempted.delete(refToken);
        }
      } finally {
        loginInFlight.current = false;
      }
    },
    [fetchData, setRef]
  );

  useEffect(() => {
    const fromUrl = searchParams.get('token');
    const fromStorage = localStorage.getItem('refToken');
    const refToken = fromUrl ?? fromStorage;
    if (!refToken || autoLoginAttempted.has(refToken)) return;
    autoLoginAttempted.add(refToken);
    setToken(refToken);
    void handleSubmit(refToken);
  }, [searchParams, handleSubmit, setToken]);

  return (
    <div className='min-w-full min-h-screen flex items-center justify-center'>
      <div className='flex justify-center items-center'>
        <div className='relative h-full items-center'>
          <div className='artboard rounded-lg p-4 phone-1 bg-white'>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(token);
              }}
            >
              <div className='m-auto h-3/4 flex flex-col items-center'>
                <div className='py-4 font-semibold text-xl'>Token</div>
                <input
                  type='text'
                  placeholder='Token eingeben'
                  className='mt-20 input input-bordered w-full max-w-xs m-auto'
                  onInput={(e: any) => {
                    e.preventDefault();
                    setToken(e.target.value);
                  }}
                />

                {sessionError && (
                  <div className='text-error text-sm text-center px-2'>
                    {sessionError}
                  </div>
                )}
                <button
                  className={`btn my-4 ${loading && 'loading'} ${
                    error && 'btn-error'
                  } ${success && 'btn-success'}`}
                  type='submit'
                >
                  Senden
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RefButtonLogin;
