import { Suspense } from 'react';
import { Card, CardContent } from 'core/components/Card';
import { UpdatePasswordContent } from './UpdatePasswordContent';

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
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
      }
    >
      <UpdatePasswordContent />
    </Suspense>
  );
}
