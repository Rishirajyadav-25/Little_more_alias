// app/dashboard/inbox/[id]/page.js - Fixed collaborative reply permissions
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function EmailView() {
  const [email, setEmail] = useState(null);
  const [user, setUser] = useState(null); // FIXED: Add user state
  const [alias, setAlias] = useState(null); // FIXED: Add alias state for permission checking
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const params = useParams();

  // Mark email as read (stable callback)
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

  // FIXED: Fetch user data
  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        return userData;
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
    return null;
  }, []);

  // FIXED: Fetch alias data for permission checking
  const fetchAlias = useCallback(async (aliasEmail) => {
    if (!aliasEmail) return null;
    
    try {
      const response = await fetch('/api/aliases');
      if (response.ok) {
        const aliases = await response.json();
        const foundAlias = aliases.find(a => a.aliasEmail === aliasEmail);
        setAlias(foundAlias);
        return foundAlias;
      }
    } catch (err) {
      console.error('Error fetching alias:', err);
    }
    return null;
  }, []);

  // Fetch email details
  const fetchEmail = useCallback(async () => {
    if (!params.id) {
      setError('No email ID provided');
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching email with ID:', params.id);
      
      // FIXED: Fetch user first, then email, then alias
      const userData = await fetchUser();
      
      const response = await fetch(`/api/inbox/${params.id}`);
      
      if (response.ok) {
        const emailData = await response.json();
        console.log('Email data received:', emailData);
        setEmail(emailData);

        // FIXED: Fetch alias data for permission checking
        if (emailData.aliasEmail) {
          await fetchAlias(emailData.aliasEmail);
        }

        // Mark unread emails as read
        if (!emailData.isRead) {
          await markAsRead();
        }
      } else if (response.status === 401) {
        router.push('/signin');
      } else if (response.status === 404) {
        setError('Email not found. It may have been deleted or you may not have permission to view it.');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || `Failed to load email (${response.status})`);
      }
    } catch (err) {
      console.error('Error fetching email:', err);
      setError('Network error while loading email. Please check your connection.');
    }
    setLoading(false);
  }, [params.id, router, markAsRead, fetchUser, fetchAlias]);

  // Fetch on mount/id change
  useEffect(() => {
    fetchEmail();
  }, [fetchEmail]);

  // Delete email
  const deleteEmail = async () => {
    if (!confirm('Are you sure you want to delete this email? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/inbox/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/dashboard/inbox');
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to delete email: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error deleting email:', err);
      alert('Network error while deleting email');
    }
  };

  // Format date helper
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

  // FIXED: Check if user can reply to this email
  const canUserReply = () => {
    if (!email || !user || !alias) return false;
    
    // Don't allow reply to sent emails
    if (email.isSentEmail) return false;
    
    // For personal aliases, owner can always reply
    if (!alias.isCollaborative) {
      return alias.ownerId?.toString() === user._id?.toString();
    }
    
    // For collaborative aliases
    if (alias.ownerId?.toString() === user._id?.toString()) {
      return true; // Owner can always reply
    }
    
    // Check collaborator permissions
    const collaborator = alias.collaborators?.find(
      c => c.userId?.toString() === user._id?.toString()
    );
    
    // Members can reply, viewers cannot
    return collaborator && collaborator.role === 'member';
  };

  // FIXED: Determine email type and display properties
  const getEmailDisplayInfo = () => {
    if (!email) return {};

    const isSentEmail = email.isSentEmail || false;
    const isReplyToSent = email.isReplyToSent || false;
    const isReverseAlias = email.isReverseAlias || false;

    return {
      isSentEmail,
      isReplyToSent,
      isReverseAlias,
      displayFrom: isSentEmail ? email.aliasEmail : email.from,
      displayTo: isSentEmail ? email.to : email.aliasEmail,
      emailType: isSentEmail ? 'Sent' : isReplyToSent ? 'Reply Received' : 'Received',
      avatarLetter: isSentEmail ? 
        (email.to?.charAt(0) || 'T') : 
        (email.from?.charAt(0) || 'F'),
      canReply: canUserReply() // FIXED: Use proper permission check
    };
  };

  // FIXED: Get user role in collaborative alias
  const getUserRole = () => {
    if (!user || !alias) return null;
    
    if (alias.ownerId?.toString() === user._id?.toString()) {
      return 'owner';
    }
    
    const collaborator = alias.collaborators?.find(
      c => c.userId?.toString() === user._id?.toString()
    );
    
    return collaborator ? collaborator.role : null;
  };

  // Loading state
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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            <h3 className="font-medium">Error Loading Email</h3>
            <p>{error}</p>
          </div>
          <div className="flex space-x-4">
            <Link
              href="/dashboard/inbox"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Inbox
            </Link>
            <button
              onClick={fetchEmail}
              className="text-green-600 hover:text-green-700 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Email not loaded
  if (!email) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-500">Email not found</p>
            <Link
              href="/dashboard/inbox"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Inbox
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayInfo = getEmailDisplayInfo();
  const userRole = getUserRole();

  // Email view
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
              {/* Email type badge */}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                displayInfo.isSentEmail 
                  ? 'bg-blue-100 text-blue-800'
                  : displayInfo.isReplyToSent 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
              }`}>
                {displayInfo.emailType}
              </span>
              {/* FIXED: Show user role for collaborative aliases */}
              {alias?.isCollaborative && userRole && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {userRole}
                </span>
              )}
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
                {/* Avatar with appropriate letter */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  displayInfo.isSentEmail 
                    ? 'bg-gradient-to-br from-blue-400 to-blue-600'
                    : displayInfo.isReplyToSent
                      ? 'bg-gradient-to-br from-green-400 to-green-600'
                      : 'bg-gradient-to-br from-gray-400 to-gray-600'
                }`}>
                  <span className="text-white text-lg font-medium">
                    {displayInfo.avatarLetter?.toUpperCase() || '?'}
                  </span>
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {email.subject || '(No Subject)'}
                  </h2>
                  <div className="space-y-1 text-sm text-gray-600">
                    {/* Dynamic From/To display based on email type */}
                    <div>
                      <span className="font-medium text-gray-700">From:</span> {displayInfo.displayFrom || 'Unknown'}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">To:</span> {displayInfo.displayTo || 'Unknown'}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Date:</span>{' '}
                      {email.receivedAt ? formatFullDate(email.receivedAt) : 'Unknown'}
                    </div>
                    {/* Show sender info for sent emails */}
                    {displayInfo.isSentEmail && email.senderName && (
                      <div>
                        <span className="font-medium text-gray-700">Sent by:</span> {email.senderName}
                      </div>
                    )}
                    {/* Show if this is a collaborative alias email */}
                    {alias?.isCollaborative && (
                      <div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Collaborative Alias
                        </span>
                      </div>
                    )}
                    {/* FIXED: Show permission info for collaborative aliases */}
                    {alias?.isCollaborative && userRole && (
                      <div>
                        <span className="text-xs text-gray-500">
                          Your role: {userRole} 
                          {userRole === 'member' ? ' (can reply)' : userRole === 'viewer' ? ' (view only)' : ' (full access)'}
                        </span>
                      </div>
                    )}
                    {email.attachments?.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700">Attachments:</span>{' '}
                        {email.attachments.length} file
                        {email.attachments.length > 1 ? 's' : ''}
                      </div>
                    )}
                    {email.isForwarded && (
                      <div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Forwarded to {email.realEmail}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* FIXED: Actions with proper collaborative permissions */}
              <div className="flex items-center space-x-2">
                {displayInfo.canReply && (
                  <Link
                    href={`/dashboard/send?reply=${params.id}&alias=${email.aliasEmail}`}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Reply
                  </Link>
                )}
                {/* FIXED: Show why reply is disabled for viewers */}
                {!displayInfo.canReply && !displayInfo.isSentEmail && alias?.isCollaborative && userRole === 'viewer' && (
                  <span className="inline-flex items-center px-3 py-2 text-sm text-gray-500 bg-gray-100 rounded-md">
                    Reply (Viewer Access Only)
                  </span>
                )}
                <button
                  onClick={deleteEmail}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Delete
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
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed font-mono text-sm bg-gray-50 p-4 rounded-md border">
                {email.bodyPlain || 'No email content available.'}
              </div>
            )}
          </div>

          {/* Attachments */}
          {email.attachments?.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Attachments ({email.attachments.length})
              </h4>
              <div className="space-y-2">
                {email.attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <span className="text-xl">📎</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {attachment.filename || `Attachment ${index + 1}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {attachment.contentType || 'Unknown type'}
                        {attachment.size && ` • ${Math.round(attachment.size / 1024)} KB`}
                      </p>
                    </div>
                    <button
                      className="flex-shrink-0 text-sm text-blue-600 hover:text-blue-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                      onClick={() =>
                        alert('Download functionality would be implemented here with proper file serving.')
                      }
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Technical Details */}
          <details className="px-6 py-4 border-t border-gray-200">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded">
              Technical Details
            </summary>
            <div className="mt-3 space-y-2 text-xs text-gray-600 bg-gray-50 p-4 rounded-md">
              <div>
                <strong>Email ID:</strong> {email._id}
              </div>
              <div>
                <strong>User Role:</strong> {userRole || 'Unknown'}
              </div>
              <div>
                <strong>Can Reply:</strong> {displayInfo.canReply ? 'Yes' : 'No'}
              </div>
              <div>
                <strong>Is Collaborative:</strong> {alias?.isCollaborative ? 'Yes' : 'No'}
              </div>
              <div>
                <strong>Message ID:</strong> {email.messageId || 'N/A'}
              </div>
              <div>
                <strong>User ID:</strong> {email.userId} ({typeof email.userId})
              </div>
              <div>
                <strong>Alias ID:</strong> {email.aliasId || 'N/A'}
              </div>
              <div>
                <strong>Email Type:</strong> {displayInfo.emailType}
              </div>
              <div>
                <strong>Is Sent Email:</strong> {displayInfo.isSentEmail ? 'Yes' : 'No'}
              </div>
              <div>
                <strong>Is Reply to Sent:</strong> {displayInfo.isReplyToSent ? 'Yes' : 'No'}
              </div>
              <div>
                <strong>Is Reverse Alias:</strong> {displayInfo.isReverseAlias ? 'Yes' : 'No'}
              </div>
              {email.reverseAliasId && (
                <div>
                  <strong>Reverse Alias ID:</strong> {email.reverseAliasId}
                </div>
              )}
              {email.sentBy && (
                <div>
                  <strong>Sent By User ID:</strong> {email.sentBy.toString()}
                </div>
              )}
              <div>
                <strong>Forwarded:</strong> {email.isForwarded ? 'Yes' : 'No'}
                {email.isForwarded && email.forwardedAt && (
                  <span> at {formatFullDate(email.forwardedAt)}</span>
                )}
              </div>
              <div>
                <strong>Read Status:</strong> {email.isRead ? 'Read' : 'Unread'}
                {email.isRead && email.readAt && (
                  <span> at {formatFullDate(email.readAt)}</span>
                )}
              </div>
            </div>
          </details>
        </div>

        {/* Additional Actions */}
        <div className="mt-6 flex justify-between">
          <div className="flex space-x-3">
            <Link
              href="/dashboard/inbox"
              className="text-gray-600 hover:text-gray-700 font-medium"
            >
              ← Back to Inbox
            </Link>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => window.print()}
              className="text-gray-600 hover:text-gray-700 font-medium"
            >
              Print
            </button>
            <button
              onClick={() => {
                const emailText = `From: ${displayInfo.displayFrom}\nTo: ${displayInfo.displayTo}\nSubject: ${email.subject}\nDate: ${formatFullDate(email.receivedAt)}\nType: ${displayInfo.emailType}\n\n${email.bodyPlain}`;
                navigator.clipboard.writeText(emailText).then(() => {
                  alert('Email content copied to clipboard!');
                }).catch(() => {
                  alert('Failed to copy email content');
                });
              }}
              className="text-gray-600 hover:text-gray-700 font-medium"
            >
              Copy Text
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}