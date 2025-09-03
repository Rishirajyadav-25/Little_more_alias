'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function EmailView() {
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const params = useParams();

  // ✅ Mark email as read (stable callback)
  const markAsRead = useCallback(async () => {
    try {
      await fetch(`/api/inbox/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, [params.id]);

  // ✅ Fetch email details (uses markAsRead)
  const fetchEmail = useCallback(async () => {
    try {
      const response = await fetch(`/api/inbox/${params.id}`);
      if (response.ok) {
        const emailData = await response.json();
        setEmail(emailData);

        // Mark unread emails as read
        if (!emailData.isRead) {
          await markAsRead();
        }
      } else if (response.status === 401) {
        router.push('/signin');
      } else if (response.status === 404) {
        setError('Email not found');
      } else {
        setError('Failed to load email');
      }
    } catch (err) {
      console.error('Error fetching email:', err);
      setError('Failed to load email');
    }
    setLoading(false);
  }, [params.id, router, markAsRead]);

  // ✅ Fetch on mount/id change
  useEffect(() => {
    if (params.id) {
      fetchEmail();
    }
  }, [params.id, fetchEmail]);

  // ✅ Delete email
  const deleteEmail = async () => {
    if (!confirm('Are you sure you want to delete this email?')) return;

    try {
      const response = await fetch(`/api/inbox/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/dashboard/inbox');
      }
    } catch (err) {
      console.error('Error deleting email:', err);
    }
  };

  // ✅ Format date helper
  const formatFullDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ✅ Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading email...</p>
        </div>
      </div>
    );
  }

  // ✅ Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
          <Link
            href="/dashboard/inbox"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Inbox
          </Link>
        </div>
      </div>
    );
  }

  // ✅ Email details
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard/inbox"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                ← Inbox
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-xl font-semibold text-gray-900 truncate">
                {email.subject || '(No Subject)'}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border">
          {/* Email Header */}
          <div className="px-6 py-6 border-b border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start space-x-4">
                {/* Avatar */}
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg font-medium">
                    {email.from.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {email.subject || '(No Subject)'}
                  </h2>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>
                      <span className="font-medium text-gray-700">From:</span> {email.from}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">To:</span> {email.aliasEmail}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Date:</span>{' '}
                      {formatFullDate(email.receivedAt)}
                    </div>
                    {email.attachments?.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700">Attachments:</span>{' '}
                        {email.attachments.length} file
                        {email.attachments.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <Link
                  href={`/dashboard/send?reply=${params.id}`}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  ↩️ Reply
                </Link>
                <button
                  onClick={deleteEmail}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>

          {/* Email Body */}
          <div className="px-6 py-6">
            {email.bodyHtml ? (
              <div
                className="prose max-w-none text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
              />
            ) : (
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed font-mono text-sm">
                {email.bodyPlain}
              </div>
            )}
          </div>

          {/* Attachments */}
          {email.attachments?.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Attachments</h4>
              <div className="space-y-2">
                {email.attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border"
                  >
                    <span className="text-xl">📎</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {attachment.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {attachment.contentType} • {Math.round(attachment.size / 1024)} KB
                      </p>
                    </div>
                    <button
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      onClick={() =>
                        alert('Download functionality would be implemented here')
                      }
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technical Details */}
          <details className="px-6 py-4 border-t border-gray-200">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
              Technical Details
            </summary>
            <div className="mt-3 space-y-2 text-xs text-gray-600">
              <div>
                <strong>Message ID:</strong> {email.messageId || 'N/A'}
              </div>
              <div>
                <strong>Forwarded:</strong> {email.isForwarded ? 'Yes' : 'No'}
              </div>
              {email.forwardedAt && (
                <div>
                  <strong>Forwarded At:</strong> {formatFullDate(email.forwardedAt)}
                </div>
              )}
              {email.headers?.length > 0 && (
                <div className="mt-3">
                  <strong>Headers:</strong>
                  <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                    {JSON.stringify(email.headers, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
