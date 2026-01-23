'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { Card, CardContent } from 'core/components/Card';
import { Alert } from 'core/components/Alert';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      
      // Debug: Log URL info
      const hash = window.location.hash;
      const search = window.location.search;
      setDebugInfo(`Hash: ${hash || 'none'} | Search: ${search || 'none'}`);
      
      // Parse the hash to extract tokens
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const tokenType = hashParams.get('type');
      
      const hasToken = accessToken && (tokenType === 'invite' || tokenType === 'recovery');
      
      if (hasToken && accessToken && refreshToken) {
        // Valid token present in URL, explicitly set the session
        setIsValidSession(true);
        setDebugInfo(prev => `${prev} | Token detected, setting session...`);
        
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (error) {
            console.error('Error setting session:', error);
            setDebugInfo(prev => `${prev} | Error: ${error.message}`);
            setIsValidSession(false);
            return;
          }
          
          if (data.session) {
            setDebugInfo(prev => `${prev} | Session established!`);
            setIsValidSession(true);
            setSessionReady(true);
            
            // Clear the hash from URL for security
            window.history.replaceState(null, '', window.location.pathname);
          }
        } catch (err) {
          console.error('Error setting session:', err);
          setIsValidSession(false);
          return;
        }
      }
      
      // Listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event, 'Session:', !!session);
        setDebugInfo(prev => `${prev} | Event: ${event}`);
        
        if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
          setIsValidSession(true);
          setSessionReady(true);
        } else if (event === 'INITIAL_SESSION') {
          if (session) {
            setIsValidSession(true);
            setSessionReady(true);
          } else if (!hasToken) {
            // No token and no session, invalid link
            setIsValidSession(false);
            setSessionReady(false);
          }
        }
      });

      // If no token in URL, check for existing session
      if (!hasToken) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsValidSession(true);
          setSessionReady(true);
        } else {
          // No token, no session - invalid
          setTimeout(() => {
            setIsValidSession(false);
          }, 1000);
        }
      }

      return () => {
        subscription.unsubscribe();
      };
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-600">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isValidSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 space-y-4">
            <div className="text-center mb-4">
              <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h1>
              <p className="text-gray-600 mb-4">
                This password reset link is invalid or has expired.
              </p>
              {debugInfo && (
                <details className="text-left bg-gray-100 p-3 rounded text-xs text-gray-700 mb-4">
                  <summary className="cursor-pointer font-semibold">Debug Info</summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words">{debugInfo}</pre>
                </details>
              )}
            </div>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => router.push('/login')}
            >
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="text-center">
              <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Set Successfully!</h1>
              <p className="text-gray-600 mb-4">
                Redirecting you to the dashboard...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Set Your Password</h1>
            <p className="text-gray-600">
              Welcome! Please set your password to access your account.
            </p>
          </div>

          {!sessionReady && (
            <Alert variant="info" className="mb-6">
              <div className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Preparing your account...</span>
              </div>
            </Alert>
          )}

          {error && (
            <Alert variant="error" className="mb-6">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading || !sessionReady}
              autoComplete="new-password"
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              disabled={loading || !sessionReady}
              autoComplete="new-password"
            />

            <div className="pt-4">
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading || !sessionReady}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Setting Password...
                  </span>
                ) : !sessionReady ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Preparing...
                  </span>
                ) : (
                  'Set Password & Continue'
                )}
              </Button>
            </div>

            <div className="text-center pt-4">
              <p className="text-sm text-gray-600">
                Password must be at least 6 characters long
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
