'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { UsersTableClient } from './UsersTableClient';
import { CreateUserModal } from './CreateUserModal';

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'admin';
  active: boolean;
  created_at: string;
};

interface UsersPageClientProps {
  isDevMode: boolean;
  users: UserRow[];
  currentAdminId?: string;
}

export function UsersPageClient({ isDevMode, users, currentAdminId }: UsersPageClientProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div>
      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        isDevMode={isDevMode}
      />

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsCreateModalOpen(true)}
          disabled={isDevMode}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
        </CardHeader>
        <CardContent>
          {users && users.length > 0 ? (
            <UsersTableClient
              isDevMode={isDevMode}
              users={users}
              currentAdminId={currentAdminId}
              hideAddButton={true}
            />
          ) : (
            <p className="text-gray-500 text-center py-8">
              {isDevMode ? 'Mock users shown (configure Supabase to see real data)' : 'No users found'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
