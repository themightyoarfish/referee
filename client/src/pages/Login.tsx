import { useAdminAuth } from '../context/AdminAuthContext';
import { useNavigate } from 'react-router';

function Login() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: any) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body: Record<string, any> = {};
    for (let [key, value] of formData.entries()) {
      body[key] = value;
    }

    const res = await login(body);
    if (res) {
      navigate('/');
    }

    return body;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className='min-w-full min-h-screen flex items-center justify-center'>
        <div className='flex justify-center items-center'>
          <div className='relative h-full items-center'>
            <div className='artboard artboard-horizontal phone-1 bg-white'>
              <div className='flex flex-col space-y-4 h-full w-full justify-center items-center'>
                <div className='text-xl font-bold'>Login</div>
                <div>
                  <label className='label'>
                    <span className='label-text'>Benutzer</span>
                  </label>
                  <input
                    type='text'
                    name='user'
                    id='user'
                    placeholder='Benutzer'
                    className='input input-bordered w-full max-w-xs'
                  />
                </div>
                <div>
                  <label className='label'>
                    <span className='label-text'>Passwort</span>
                  </label>
                  <input
                    type='password'
                    name='password'
                    id='password'
                    className='input input-bordered w-full max-w-xs'
                  />
                </div>
                <div>
                  <button className='btn btn-primary' type='submit'>
                    Einloggen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

export default Login;
