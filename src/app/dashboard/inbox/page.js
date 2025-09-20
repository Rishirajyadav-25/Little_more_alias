'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function Inbox() {
  const [emails, setEmails] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlias, setSelectedAlias] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pagination, setPagination] = useState({});
  const [counts, setCounts] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  // NEW: Add mailType state
  const [mailType, setMailType] = useState('all'); // 'all', 'sent', 'received'
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const aliasParam = searchParams.get('alias');
    const unreadParam = searchParams.get('unread');
    const typeParam = searchParams.get('type');
    if (aliasParam) setSelectedAlias(aliasParam);
    if (unreadParam === 'true') setUnreadOnly(true);
    if (typeParam && ['all', 'sent', 'received'].includes(typeParam)) {
      setMailType(typeParam);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchEmails();
    fetchAliases();
  }, [currentPage, selectedAlias, unreadOnly, mailType]);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      });
      
      if (selectedAlias) params.append('alias', selectedAlias);
      if (unreadOnly) params.append('unread', 'true');
      if (mailType !== 'all') params.append('type', mailType);

      const response = await fetch(`/api/inbox?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEmails(data.emails || []);
        setPagination(data.pagination || {});
        setCounts(data.counts || {});
      } else if (response.status === 401) {
        router.push('/signin');
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
    }
    setLoading(false);
  };

  const fetchAliases = async () => {
    try {
      const response = await fetch('/api/aliases');
      if (response.ok) {
        const data = await response.json();
        setAliases(data || []);
      }
    } catch (error) {
      console.error('Error fetching aliases:', error);
    }
  };

  const markAsRead = async (emailId, isRead) => {
    try {
      await fetch(`/api/inbox/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead })
      });
      fetchEmails();
    } catch (error) {
      console.error('Error updating email:', error);
    }
  };

  const deleteEmail = async (emailId) => {
    if (!confirm('Delete this email?')) return;
    try {
      await fetch(`/api/inbox/${emailId}`, { method: 'DELETE' });
      fetchEmails();
    } catch (error) {
      console.error('Error deleting email:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays <= 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
                ← Dashboard
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">
                Inbox
                {counts.unread > 0 && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {counts.unread} unread
                  </span>
                )}
              </h1>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={fetchEmails}
                className="text-gray-600 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100"
              >
                🔄
              </button>
              <Link 
                href="/dashboard/send"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Compose
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* NEW: Mail Type Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => {
                  setMailType('all');
                  setCurrentPage(1);
                }}
                className={`${
                  mailType === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                All ({counts.total || 0})
              </button>
              <button
                onClick={() => {
                  setMailType('received');
                  setCurrentPage(1);
                }}
                className={`${
                  mailType === 'received'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Received ({counts.received || 0})
              </button>
              <button
                onClick={() => {
                  setMailType('sent');
                  setCurrentPage(1);
                }}
                className={`${
                  mailType === 'sent'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Sent ({counts.sent || 0})
              </button>
            </nav>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border mb-6 p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <select
              value={selectedAlias}
              onChange={(e) => {
                setSelectedAlias(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All aliases ({aliases.length})</option>
              {aliases.map((alias) => (
                <option key={alias._id} value={alias.aliasEmail}>
                  {alias.aliasEmail}
                </option>
              ))}
            </select>
            
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => {
                  setUnreadOnly(e.target.checked);
                  setCurrentPage(1);
                }}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Unread only</span>
            </label>

            <div className="text-sm text-gray-500 ml-auto">
              {mailType === 'all' ? 'All emails' : 
               mailType === 'sent' ? 'Sent emails' : 'Received emails'}: {pagination.totalCount || 0}
            </div>
          </div>
        </div>

        {/* Email List */}
        <div className="bg-white rounded-lg shadow-sm border">
          {emails.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-6xl mb-4">📪</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No {mailType === 'all' ? '' : mailType} emails found
              </h3>
              <p className="text-gray-500 mb-4">
                {selectedAlias 
                  ? `No ${mailType === 'all' ? '' : mailType} emails for ${selectedAlias}`
                  : `Your ${mailType === 'all' ? '' : mailType} emails will appear here`
                }
              </p>
              <button
                onClick={fetchEmails}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Refresh inbox
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {emails.map((email) => (
                <div 
                  key={email._id} 
                  className={`px-6 py-4 hover:bg-gray-50 cursor-pointer ${
                    !email.isRead ? 'bg-blue-50 border-l-4 border-blue-400' : ''
                  }`}
                  onClick={() => router.push(`/dashboard/inbox/${email._id}`)}
                >
                  <div className="flex justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {/* FIXED: Show appropriate initial based on email type */}
                            {email.isSentEmail 
                              ? (email.senderName?.charAt(0) || email.from?.charAt(0) || 'S')?.toUpperCase()
                              : (email.from?.charAt(0) || '?')?.toUpperCase()
                            }
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className={`text-sm ${!email.isRead ? 'font-semibold' : ''}`}>
                              {/* FIXED: Display appropriate sender/recipient */}
                              {email.isSentEmail 
                                ? `To: ${email.to}` 
                                : `From: ${email.from || 'Unknown'}`
                              }
                            </p>
                            {!email.isRead && <span className="w-2 h-2 bg-blue-600 rounded-full"></span>}
                            {email.isSentEmail && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                Sent
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {email.isSentEmail ? `From: ${email.aliasEmail}` : `To: ${email.aliasEmail}`}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(email.receivedAt)}</span>
                      </div>
                      <div className="ml-11">
                        <p className={`text-sm mb-1 ${!email.isRead ? 'font-medium' : ''}`}>
                          {email.subject || '(No Subject)'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {email.bodyPlain?.substring(0, 100) || 'No preview'}...
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(email._id, !email.isRead);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title={email.isRead ? 'Mark unread' : 'Mark read'}
                      >
                        {email.isRead ? '📭' : '📬'}
                      </button>
                      {!email.isSentEmail && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/send?reply=${email._id}`);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Reply"
                        >
                          ↩️
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEmail(email._id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t flex justify-between items-center">
              <span className="text-sm text-gray-500">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  disabled={!pagination.hasPrev}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={!pagination.hasNext}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}






















// // app/dashboard/inbox/page.js - Main inbox list page
// 'use client';
// import { useState, useEffect } from 'react';
// import { useRouter, useSearchParams } from 'next/navigation';
// import Link from 'next/link';

// export default function Inbox() {
//   const [emails, setEmails] = useState([]);
//   const [aliases, setAliases] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');
//   const [selectedAlias, setSelectedAlias] = useState('');
//   const [unreadOnly, setUnreadOnly] = useState(false);
//   const [pagination, setPagination] = useState({});
//   const [unreadCount, setUnreadCount] = useState(0);
//   const [currentPage, setCurrentPage] = useState(1);
//   const [debugInfo, setDebugInfo] = useState(null);
//   const router = useRouter();
//   const searchParams = useSearchParams();

//   useEffect(() => {
//     // Get initial filters from URL
//     const aliasParam = searchParams.get('alias');
//     const unreadParam = searchParams.get('unread');
//     const pageParam = searchParams.get('page');

//     if (aliasParam) setSelectedAlias(aliasParam);
//     if (unreadParam === 'true') setUnreadOnly(true);
//     if (pageParam) setCurrentPage(parseInt(pageParam));
//   }, [searchParams]);

//   useEffect(() => {
//     fetchEmails();
//     fetchAliases();
//   }, [currentPage, selectedAlias, unreadOnly]);

//   const fetchEmails = async () => {
//     setLoading(true);
//     setError('');
    
//     try {
//       const params = new URLSearchParams({
//         page: currentPage.toString(),
//         limit: '20'
//       });
      
//       if (selectedAlias) params.append('alias', selectedAlias);
//       if (unreadOnly) params.append('unread', 'true');

//       console.log('Fetching emails with params:', params.toString());

//       const response = await fetch(`/api/inbox?${params}`);
      
//       if (response.ok) {
//         const data = await response.json();
//         console.log('Fetched emails response:', data);
        
//         setEmails(data.emails || []);
//         setPagination(data.pagination || {});
//         setUnreadCount(data.unreadCount || 0);
//         setDebugInfo(data.debug || null);
//       } else if (response.status === 401) {
//         router.push('/signin');
//       } else {
//         const errorData = await response.json().catch(() => ({}));
//         setError(errorData.error || `Failed to load emails (${response.status})`);
//       }
//     } catch (error) {
//       console.error('Error fetching emails:', error);
//       setError('Network error while loading emails');
//     }
    
//     setLoading(false);
//   };

//   const fetchAliases = async () => {
//     try {
//       const response = await fetch('/api/aliases');
//       if (response.ok) {
//         const aliasData = await response.json();
//         setAliases(aliasData || []);
//       }
//     } catch (error) {
//       console.error('Error fetching aliases:', error);
//     }
//   };

//   const markAsRead = async (emailId, isRead) => {
//     try {
//       const response = await fetch(`/api/inbox/${emailId}`, {
//         method: 'PATCH',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ isRead })
//       });

//       if (response.ok) {
//         fetchEmails(); // Refresh the list
//       } else {
//         console.error('Failed to update email status');
//       }
//     } catch (error) {
//       console.error('Error updating email:', error);
//     }
//   };

//   const deleteEmail = async (emailId) => {
//     if (!confirm('Are you sure you want to delete this email?')) return;

//     try {
//       const response = await fetch(`/api/inbox/${emailId}`, {
//         method: 'DELETE'
//       });

//       if (response.ok) {
//         fetchEmails(); // Refresh the list
//       } else {
//         console.error('Failed to delete email');
//       }
//     } catch (error) {
//       console.error('Error deleting email:', error);
//     }
//   };

//   const formatDate = (dateString) => {
//     const date = new Date(dateString);
//     const now = new Date();
//     const diffTime = Math.abs(now - date);
//     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

//     if (diffDays === 1) {
//       return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//     } else if (diffDays <= 7) {
//       return date.toLocaleDateString([], { weekday: 'short' });
//     } else {
//       return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
//     }
//   };

//   const refreshInbox = () => {
//     fetchEmails();
//   };

//   const debugDatabase = async () => {
//     try {
//       const response = await fetch('/api/debug/inbox');
//       if (response.ok) {
//         const data = await response.json();
//         console.log('Database debug info:', data);
//         alert('Database debug info logged to console. Check browser dev tools.');
//       }
//     } catch (error) {
//       console.error('Debug error:', error);
//     }
//   };

//   const createTestEmail = async () => {
//     try {
//       const response = await fetch('/api/debug/create-test-email', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' }
//       });
      
//       if (response.ok) {
//         const data = await response.json();
//         console.log('Test email created:', data);
//         alert(`Test email created with ID: ${data.emailId}`);
//         fetchEmails(); // Refresh to show the new email
//       } else {
//         const error = await response.json();
//         alert(`Failed to create test email: ${error.error}`);
//       }
//     } catch (error) {
//       console.error('Test email creation error:', error);
//       alert('Network error creating test email');
//     }
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
//           <p className="text-gray-600">Loading inbox...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header */}
//       <div className="bg-white shadow-sm border-b">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="flex items-center justify-between h-16">
//             <div className="flex items-center space-x-4">
//               <Link 
//                 href="/dashboard" 
//                 className="text-blue-600 hover:text-blue-700 font-medium"
//               >
//                 ← Dashboard
//               </Link>
//               <div className="h-6 w-px bg-gray-300"></div>
//               <h1 className="text-xl font-semibold text-gray-900">
//                 Inbox
//                 {unreadCount > 0 && (
//                   <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
//                     {unreadCount} unread
//                   </span>
//                 )}
//               </h1>
//             </div>
//             <div className="flex items-center space-x-3">
//               <button
//                 onClick={refreshInbox}
//                 className="text-gray-600 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100"
//                 title="Refresh inbox"
//               >
//                 🔄
//               </button>
//               <Link 
//                 href="/dashboard/send"
//                 className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
//               >
//                 Compose
//               </Link>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         {/* Error Alert */}
//         {error && (
//           <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
//             {error}
//             <button 
//               onClick={() => setError('')} 
//               className="ml-2 text-red-600 hover:text-red-800"
//             >
//               ✕
//             </button>
//           </div>
//         )}

//         {/* Debug Panel - Remove in production */}
//         <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
//           <h4 className="font-medium text-yellow-900 mb-3">Debug Information</h4>
//           <div className="text-sm text-yellow-800 space-y-2">
//             <div>Total emails found: {emails.length}</div>
//             <div>Unread count: {unreadCount}</div>
//             <div>Current filters: alias={selectedAlias || 'all'}, unread={unreadOnly ? 'yes' : 'no'}</div>
//             <div>Page: {currentPage} of {pagination.totalPages || 1}</div>
//             {debugInfo && (
//               <div>
//                 <div>Database inbox docs: {debugInfo.totalDocsInInbox}</div>
//                 <div>Query userId: {debugInfo.userId}</div>
//               </div>
//             )}
//             <div className="flex space-x-2 mt-3">
//               <button
//                 onClick={refreshInbox}
//                 className="bg-yellow-600 text-white px-3 py-1 rounded text-xs hover:bg-yellow-700"
//               >
//                 Refresh
//               </button>
//               <button
//                 onClick={debugDatabase}
//                 className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
//               >
//                 Debug DB
//               </button>
//               <button
//                 onClick={createTestEmail}
//                 className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
//               >
//                 Create Test Email
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Filters */}
//         <div className="bg-white rounded-lg shadow-sm border mb-6">
//           <div className="px-6 py-4">
//             <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
//               <div className="flex flex-col sm:flex-row gap-4">
//                 <div>
//                   <label htmlFor="alias-filter" className="block text-sm font-medium text-gray-700 mb-1">
//                     Filter by alias
//                   </label>
//                   <select
//                     id="alias-filter"
//                     value={selectedAlias}
//                     onChange={(e) => {
//                       setSelectedAlias(e.target.value);
//                       setCurrentPage(1);
//                     }}
//                     className="block w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
//                   >
//                     <option value="">All aliases ({aliases.length})</option>
//                     {aliases.map((alias) => (
//                       <option key={alias._id} value={alias.aliasEmail}>
//                         {alias.aliasEmail}
//                       </option>
//                     ))}
//                   </select>
//                 </div>
                
//                 <div className="flex items-center mt-6 sm:mt-0">
//                   <label className="flex items-center cursor-pointer">
//                     <input
//                       type="checkbox"
//                       checked={unreadOnly}
//                       onChange={(e) => {
//                         setUnreadOnly(e.target.checked);
//                         setCurrentPage(1);
//                       }}
//                       className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
//                     />
//                     <span className="ml-2 text-sm text-gray-700">Show unread only</span>
//                   </label>
//                 </div>
//               </div>

//               <div className="flex items-center space-x-2 text-sm text-gray-500">
//                 <span>{pagination.totalCount || 0} emails total</span>
//                 {selectedAlias && <span>• Filtered by {selectedAlias}</span>}
//                 {unreadOnly && <span>• Unread only</span>}
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Email List */}
//         <div className="bg-white rounded-lg shadow-sm border">
//           {emails.length === 0 ? (
//             <div className="px-6 py-12 text-center">
//               <div className="text-6xl mb-4">
//                 {loading ? '⏳' : unreadOnly ? '📭' : selectedAlias ? '📬' : '📪'}
//               </div>
//               <h3 className="text-lg font-medium text-gray-900 mb-2">
//                 {loading ? 'Loading...' : unreadOnly ? 'No unread emails' : 'No emails found'}
//               </h3>
//               <p className="text-gray-500 mb-6">
//                 {loading 
//                   ? 'Please wait while we load your emails...'
//                   : unreadOnly 
//                     ? 'All caught up! No new emails to read.'
//                     : selectedAlias 
//                       ? `No emails received at ${selectedAlias} yet.`
//                       : 'Emails sent to your aliases will appear here and be forwarded to your real email.'
//                 }
//               </p>
//               {!loading && !selectedAlias && !unreadOnly && (
//                 <div className="space-y-2">
//                   <Link 
//                     href="/dashboard"
//                     className="text-blue-600 hover:text-blue-700 font-medium block"
//                   >
//                     Create your first alias →
//                   </Link>
//                   <div className="text-sm text-gray-500">
//                     <button
//                       onClick={refreshInbox}
//                       className="text-blue-600 hover:text-blue-700"
//                     >
//                       Refresh to check for new emails
//                     </button>
//                     {' or '}
//                     <button
//                       onClick={createTestEmail}
//                       className="text-green-600 hover:text-green-700"
//                     >
//                       create a test email
//                     </button>
//                   </div>
//                 </div>
//               )}
//             </div>
//           ) : (
//             <div className="divide-y divide-gray-200">
//               {emails.map((email) => (
//                 <div 
//                   key={email._id} 
//                   className={`px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
//                     !email.isRead ? 'bg-blue-50 border-l-4 border-blue-400' : ''
//                   }`}
//                   onClick={() => router.push(`/dashboard/inbox/${email._id}`)}
//                 >
//                   <div className="flex items-start justify-between">
//                     <div className="flex-1 min-w-0">
//                       <div className="flex items-center space-x-3 mb-2">
//                         <div className="flex-shrink-0">
//                           <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
//                             <span className="text-white text-sm font-medium">
//                               {email.from?.charAt(0)?.toUpperCase() || '?'}
//                             </span>
//                           </div>
//                         </div>
//                         <div className="flex-1 min-w-0">
//                           <div className="flex items-center space-x-2">
//                             <p className={`text-sm truncate ${
//                               email.isRead ? 'text-gray-900' : 'text-gray-900 font-semibold'
//                             }`}>
//                               {email.from || 'Unknown sender'}
//                             </p>
//                             {!email.isRead && (
//                               <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full"></span>
//                             )}
//                           </div>
//                           <p className="text-xs text-gray-500 truncate">
//                             To: {email.aliasEmail || 'Unknown alias'}
//                           </p>
//                         </div>
//                         <div className="flex-shrink-0 text-right">
//                           <p className="text-xs text-gray-500">
//                             {formatDate(email.receivedAt)}
//                           </p>
//                           {email.attachments && email.attachments.length > 0 && (
//                             <div className="flex items-center justify-end mt-1">
//                               <span className="text-xs text-gray-400">📎 {email.attachments.length}</span>
//                             </div>
//                           )}
//                         </div>
//                       </div>
                      
//                       <div className="ml-11">
//                         <p className={`text-sm mb-1 ${
//                           email.isRead ? 'text-gray-900' : 'text-gray-900 font-medium'
//                         }`}>
//                           {email.subject || '(No Subject)'}
//                         </p>
                        
//                         <p className="text-sm text-gray-600 line-clamp-2">
//                           {email.bodyPlain?.substring(0, 150) || 'No content preview available'}
//                           {(email.bodyPlain?.length || 0) > 150 && '...'}
//                         </p>
//                       </div>
//                     </div>
                    
//                     <div className="flex items-center space-x-1 ml-4">
//                       <button
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           markAsRead(email._id, !email.isRead);
//                         }}
//                         className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
//                         title={email.isRead ? 'Mark as unread' : 'Mark as read'}
//                       >
//                         {email.isRead ? '📭' : '📬'}
//                       </button>
                      
//                       <button
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           router.push(`/dashboard/send?reply=${email._id}`);
//                         }}
//                         className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
//                         title="Reply"
//                       >
//                         ↩️
//                       </button>
                      
//                       <button
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           deleteEmail(email._id);
//                         }}
//                         className="p-1 text-gray-400 hover:text-red-600 transition-colors"
//                         title="Delete"
//                       >
//                         🗑️
//                       </button>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* Pagination */}
//           {pagination.totalPages > 1 && (
//             <div className="px-6 py-4 border-t border-gray-200">
//               <div className="flex items-center justify-between">
//                 <div className="flex items-center space-x-2 text-sm text-gray-500">
//                   <span>
//                     Showing {((pagination.currentPage - 1) * 20) + 1} to {Math.min(pagination.currentPage * 20, pagination.totalCount)} of {pagination.totalCount} emails
//                   </span>
//                 </div>
                
//                 <div className="flex items-center space-x-2">
//                   <button
//                     onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
//                     disabled={!pagination.hasPrev}
//                     className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
//                   >
//                     Previous
//                   </button>
                  
//                   <span className="px-3 py-1 text-sm text-gray-700">
//                     Page {pagination.currentPage} of {pagination.totalPages}
//                   </span>
                  
//                   <button
//                     onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
//                     disabled={!pagination.hasNext}
//                     className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
//                   >
//                     Next
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }





// // app/dashboard/inbox/page.js - CLEAN VERSION
// 'use client';
// import { useState, useEffect } from 'react';
// import { useRouter, useSearchParams } from 'next/navigation';
// import Link from 'next/link';

// export default function Inbox() {
//   const [emails, setEmails] = useState([]);
//   const [aliases, setAliases] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedAlias, setSelectedAlias] = useState('');
//   const [unreadOnly, setUnreadOnly] = useState(false);
//   const [pagination, setPagination] = useState({});
//   const [unreadCount, setUnreadCount] = useState(0);
//   const [currentPage, setCurrentPage] = useState(1);
//   const router = useRouter();
//   const searchParams = useSearchParams();

//   useEffect(() => {
//     const aliasParam = searchParams.get('alias');
//     const unreadParam = searchParams.get('unread');
//     if (aliasParam) setSelectedAlias(aliasParam);
//     if (unreadParam === 'true') setUnreadOnly(true);
//   }, [searchParams]);

//   useEffect(() => {
//     fetchEmails();
//     fetchAliases();
//   }, [currentPage, selectedAlias, unreadOnly]);

//   const fetchEmails = async () => {
//     setLoading(true);
//     try {
//       const params = new URLSearchParams({
//         page: currentPage.toString(),
//         limit: '20'
//       });
      
//       if (selectedAlias) params.append('alias', selectedAlias);
//       if (unreadOnly) params.append('unread', 'true');

//       const response = await fetch(`/api/inbox?${params}`);
//       if (response.ok) {
//         const data = await response.json();
//         setEmails(data.emails || []);
//         setPagination(data.pagination || {});
//         setUnreadCount(data.unreadCount || 0);
//       } else if (response.status === 401) {
//         router.push('/signin');
//       }
//     } catch (error) {
//       console.error('Error fetching emails:', error);
//     }
//     setLoading(false);
//   };

//   const fetchAliases = async () => {
//     try {
//       const response = await fetch('/api/aliases');
//       if (response.ok) {
//         const data = await response.json();
//         setAliases(data || []);
//       }
//     } catch (error) {
//       console.error('Error fetching aliases:', error);
//     }
//   };

//   const markAsRead = async (emailId, isRead) => {
//     try {
//       await fetch(`/api/inbox/${emailId}`, {
//         method: 'PATCH',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ isRead })
//       });
//       fetchEmails();
//     } catch (error) {
//       console.error('Error updating email:', error);
//     }
//   };

//   const deleteEmail = async (emailId) => {
//     if (!confirm('Delete this email?')) return;
//     try {
//       await fetch(`/api/inbox/${emailId}`, { method: 'DELETE' });
//       fetchEmails();
//     } catch (error) {
//       console.error('Error deleting email:', error);
//     }
//   };

//   const formatDate = (dateString) => {
//     const date = new Date(dateString);
//     const now = new Date();
//     const diffDays = Math.ceil((now - date) / (1000 * 60 * 60 * 24));
    
//     if (diffDays <= 1) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//     if (diffDays <= 7) return date.toLocaleDateString([], { weekday: 'short' });
//     return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
//           <p className="text-gray-600">Loading inbox...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header */}
//       <div className="bg-white shadow-sm border-b">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="flex items-center justify-between h-16">
//             <div className="flex items-center space-x-4">
//               <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
//                 ← Dashboard
//               </Link>
//               <h1 className="text-xl font-semibold text-gray-900">
//                 Inbox
//                 {unreadCount > 0 && (
//                   <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
//                     {unreadCount} unread
//                   </span>
//                 )}
//               </h1>
//             </div>
//             <div className="flex space-x-3">
//               <button
//                 onClick={fetchEmails}
//                 className="text-gray-600 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100"
//               >
//                 🔄
//               </button>
//               <Link 
//                 href="/dashboard/send"
//                 className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
//               >
//                 Compose
//               </Link>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         {/* Filters */}
//         <div className="bg-white rounded-lg shadow-sm border mb-6 p-4">
//           <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
//             <select
//               value={selectedAlias}
//               onChange={(e) => {
//                 setSelectedAlias(e.target.value);
//                 setCurrentPage(1);
//               }}
//               className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
//             >
//               <option value="">All aliases ({aliases.length})</option>
//               {aliases.map((alias) => (
//                 <option key={alias._id} value={alias.aliasEmail}>
//                   {alias.aliasEmail}
//                 </option>
//               ))}
//             </select>
            
//             <label className="flex items-center cursor-pointer">
//               <input
//                 type="checkbox"
//                 checked={unreadOnly}
//                 onChange={(e) => {
//                   setUnreadOnly(e.target.checked);
//                   setCurrentPage(1);
//                 }}
//                 className="h-4 w-4 text-blue-600 border-gray-300 rounded"
//               />
//               <span className="ml-2 text-sm text-gray-700">Unread only</span>
//             </label>

//             <div className="text-sm text-gray-500 ml-auto">
//               {pagination.totalCount || 0} emails
//             </div>
//           </div>
//         </div>

//         {/* Email List */}
//         <div className="bg-white rounded-lg shadow-sm border">
//           {emails.length === 0 ? (
//             <div className="px-6 py-12 text-center">
//               <div className="text-6xl mb-4">📪</div>
//               <h3 className="text-lg font-medium text-gray-900 mb-2">No emails found</h3>
//               <p className="text-gray-500 mb-4">
//                 {selectedAlias 
//                   ? `No emails for ${selectedAlias}`
//                   : 'Your received emails will appear here'
//                 }
//               </p>
//               <button
//                 onClick={fetchEmails}
//                 className="text-blue-600 hover:text-blue-700 font-medium"
//               >
//                 Refresh inbox
//               </button>
//             </div>
//           ) : (
//             <div className="divide-y divide-gray-200">
//               {emails.map((email) => (
//                 <div 
//                   key={email._id} 
//                   className={`px-6 py-4 hover:bg-gray-50 cursor-pointer ${
//                     !email.isRead ? 'bg-blue-50 border-l-4 border-blue-400' : ''
//                   }`}
//                   onClick={() => router.push(`/dashboard/inbox/${email._id}`)}
//                 >
//                   <div className="flex justify-between">
//                     <div className="flex-1 min-w-0">
//                       <div className="flex items-center space-x-3 mb-2">
//                         <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
//                           <span className="text-white text-sm font-medium">
//                             {email.from?.charAt(0)?.toUpperCase() || '?'}
//                           </span>
//                         </div>
//                         <div className="flex-1">
//                           <div className="flex items-center space-x-2">
//                             <p className={`text-sm ${!email.isRead ? 'font-semibold' : ''}`}>
//                               {email.from || 'Unknown'}
//                             </p>
//                             {!email.isRead && <span className="w-2 h-2 bg-blue-600 rounded-full"></span>}
//                           </div>
//                           <p className="text-xs text-gray-500">To: {email.aliasEmail}</p>
//                         </div>
//                         <span className="text-xs text-gray-500">{formatDate(email.receivedAt)}</span>
//                       </div>
//                       <div className="ml-11">
//                         <p className={`text-sm mb-1 ${!email.isRead ? 'font-medium' : ''}`}>
//                           {email.subject || '(No Subject)'}
//                         </p>
//                         <p className="text-sm text-gray-600">
//                           {email.bodyPlain?.substring(0, 100) || 'No preview'}...
//                         </p>
//                       </div>
//                     </div>
//                     <div className="flex items-center space-x-1 ml-4">
//                       <button
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           markAsRead(email._id, !email.isRead);
//                         }}
//                         className="p-1 text-gray-400 hover:text-gray-600"
//                         title={email.isRead ? 'Mark unread' : 'Mark read'}
//                       >
//                         {email.isRead ? '📭' : '📬'}
//                       </button>
//                       <button
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           deleteEmail(email._id);
//                         }}
//                         className="p-1 text-gray-400 hover:text-red-600"
//                         title="Delete"
//                       >
//                         🗑️
//                       </button>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* Pagination */}
//           {pagination.totalPages > 1 && (
//             <div className="px-6 py-4 border-t flex justify-between items-center">
//               <span className="text-sm text-gray-500">
//                 Page {pagination.currentPage} of {pagination.totalPages}
//               </span>
//               <div className="flex space-x-2">
//                 <button
//                   onClick={() => setCurrentPage(prev => prev - 1)}
//                   disabled={!pagination.hasPrev}
//                   className="px-3 py-1 border rounded disabled:opacity-50"
//                 >
//                   Previous
//                 </button>
//                 <button
//                   onClick={() => setCurrentPage(prev => prev + 1)}
//                   disabled={!pagination.hasNext}
//                   className="px-3 py-1 border rounded disabled:opacity-50"
//                 >
//                   Next
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }





