'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { Alert } from 'core/components/Alert';
import { PhoneInput } from 'core/components/PhoneInput';
import { isCompleteNanpDigits } from 'core/lib/phone-format';
import { createUser } from './actions';

type AddMode = 'invite' | 'phone';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDevMode: boolean;
  initialEmail?: string;
  initialFullName?: string;
}

export function CreateUserModal({ isOpen, onClose, isDevMode, initialEmail, initialFullName }: CreateUserModalProps) {
  const router = useRouter();
  const [addMode, setAddMode] = useState<AddMode>('invite');
  const [email, setEmail] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInvite, setSuccessInvite] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialEmail) {
        setEmail(initialEmail);
        setAddMode('invite');
      }
      if (initialFullName) {
        setFullName(initialFullName);
      }
    }
  }, [isOpen, initialEmail, initialFullName]);

  const copyTempPassword = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
    } catch {
      /* ignore */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessInvite(false);
    setTempPassword(null);
    setLoading(true);

    const result =
      addMode === 'invite'
        ? await createUser({
            mode: 'invite',
            email: email.trim(),
            fullName: fullName.trim() || undefined,
            role,
          })
        : await createUser({
            mode: 'phone',
            phoneDigits,
            fullName: fullName.trim() || undefined,
            role,
          });

    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Failed to create user');
      return;
    }

    if (result.mode === 'invite') {
      setSuccessInvite(true);
      setEmail('');
      setPhoneDigits('');
      setFullName('');
      setRole('user');
      setTimeout(() => {
        router.refresh();
        onClose();
        setSuccessInvite(false);
      }, 1500);
    } else {
      setTempPassword(result.temporaryPassword);
      setPhoneDigits('');
      setFullName('');
      setRole('user');
      router.refresh();
    }
  };

  const handleClose = () => {
    if (loading) return;
    setEmail('');
    setPhoneDigits('');
    setFullName('');
    setRole('user');
    setAddMode('invite');
    setError(null);
    setSuccessInvite(false);
    setTempPassword(null);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setPhoneDigits('');
      setFullName('');
      setRole('user');
      setAddMode('invite');
      setError(null);
      setSuccessInvite(false);
      setTempPassword(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const inviteDisabled = !email.trim() || loading || isDevMode;
  const phoneDisabled =
    !isCompleteNanpDigits(phoneDigits) || loading || isDevMode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {initialEmail ? 'Approve Access Request' : 'Add New User'}
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isDevMode && (
          <Alert variant="warning" className="mb-4">
            <p className="text-xs">
              <strong>Dev Mode:</strong> User creation requires Supabase configuration
            </p>
          </Alert>
        )}

        {tempPassword && (
          <Alert variant="success" className="mb-4">
            <p className="text-sm font-semibold mb-2">User created — share this temporary password securely (out of band)</p>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <code className="text-xs bg-white/80 px-2 py-1 rounded border break-all flex-1 min-w-0">{tempPassword}</code>
              <Button type="button" variant="outline" className="shrink-0 text-sm" onClick={copyTempPassword}>
                Copy
              </Button>
            </div>
            <p className="text-xs text-green-900">
              They should sign in with their phone number and this password. The app will require them to set a new password on first sign-in.
            </p>
            <Button type="button" variant="primary" className="w-full mt-3" onClick={handleClose}>
              Done
            </Button>
          </Alert>
        )}

        {successInvite && (
          <Alert variant="success" className="mb-4">
            <p className="text-sm">
              <strong>User invited successfully!</strong> An invitation email has been sent with a link to set their password.
            </p>
          </Alert>
        )}

        {error && (
          <Alert variant="error" className="mb-4">
            <p className="text-sm">{error}</p>
          </Alert>
        )}

        {!tempPassword && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {initialEmail ? null : (
            <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  setAddMode('invite');
                  setError(null);
                }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  addMode === 'invite'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Email invite
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddMode('phone');
                  setError(null);
                }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  addMode === 'phone'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Phone + temp password
              </button>
            </div>
          )}

          {addMode === 'invite' ? (
            <Input
              label="Email Address *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              disabled={loading || isDevMode || Boolean(initialEmail)}
            />
          ) : (
            <PhoneInput
              label="Phone (US) *"
              digits={phoneDigits}
              onDigitsChange={setPhoneDigits}
              disabled={loading || isDevMode}
              required
            />
          )}

          <Input
            label="Full Name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            disabled={loading || isDevMode}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
              disabled={loading || isDevMode}
              className="w-full px-3 py-2 border border-gray-400 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="pt-4 border-t space-y-3">
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={addMode === 'invite' ? inviteDisabled : phoneDisabled}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </span>
              ) : addMode === 'invite' ? (
                'Create User'
              ) : (
                'Create phone user'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>

          <div className="text-xs text-gray-600 bg-gray-50 rounded-md p-3">
            {addMode === 'invite' ? (
              <>
                <p className="font-semibold mb-1">Note:</p>
                <p>The new user will receive an invitation email with a link to set their password. The invitation link is valid for 24 hours.</p>
              </>
            ) : (
              <>
                <p className="font-semibold mb-1">Note:</p>
                <p>No SMS is sent. Copy the temporary password and share it securely. The user signs in with phone + password and must choose a new password before using the app.</p>
              </>
            )}
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
