'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [aliases, setAliases] = useState([]);
  const [newAlias, setNewAlias] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inboxStats, setInboxStats] = useState({ unreadCount: 0, totalEmails: 0 });
  const router = useRouter();

  useEffect(() => {
    fetchUserData();
    fetchAliases();
    fetchInboxStats();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        router.push('/signin');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
    setLoading(false);
  };

  const fetchAliases = async () => {
    try {
      const response = await fetch('/api/aliases');
      if (response.ok) {
        const aliasData = await response.json();
        setAliases(aliasData);
      }
    } catch (error) {
      console.error('Error fetching aliases:', error);
    }
  };

  const fetchInboxStats = async () => {
    try {
      const response = await fetch('/api/inbox?limit=1');
      if (response.ok) {
        const data = await response.json();
        setInboxStats({
          unreadCount: data.unreadCount || 0,
          totalEmails: data.pagination?.totalCount || 0
        });
      }
    } catch (error) {
      console.error('Error fetching inbox stats:', error);
    }
  };

  const createAlias = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: newAlias })
      });

      if (response.ok) {
        setSuccess('Alias created successfully!');
        setNewAlias('');
        fetchAliases();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create alias');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  const deleteAlias = async (aliasId) => {
    if (!confirm('Are you sure you want to delete this alias?')) return;

    try {
      const response = await fetch(`/api/aliases/${aliasId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSuccess('Alias deleted successfully!');
        fetchAliases();
      } else {
        setError('Failed to delete alias');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const upgradeToPro = async () => {
    try {
      setLoading(true);
      setError('');
      const resp = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        setError(err.error || 'Failed to create payment order');
        setLoading(false);
        return;
      }
      const data = await resp.json();
      const order = data.order;
      // Load Razorpay checkout script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.body.appendChild(script);
      script.onload = () => {
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || window.__RAZORPAY_KEY_ID || '',
          amount: order.amount,
          currency: order.currency,
          name: 'Alias Service',
          description: 'Pro Plan (Unlimited aliases)',
          order_id: order.id,
          handler: function (response) {
            setSuccess('Payment completed. Plan upgrade will be applied shortly.');
            // refresh user and aliases
            fetchUserData();
            fetchAliases();
          },
          prefill: {
            name: user?.name,
            email: user?.email
          }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      };
      script.onerror = () => { setError('Failed to load payment gateway'); setLoading(false); };
    } catch (err) {
      console.error('Upgrade error', err);
      setError('Upgrade failed');
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">Plan: <strong className="text-gray-900">{user?.plan === 'pro' ? 'Pro (Unlimited)' : `Free`}</strong></div>
              {user?.plan !== 'pro' && (
                <button onClick={upgradeToPro} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors">Upgrade</button>
              )}
            
              <span className="text-gray-600">Welcome, {user?.name}</span>
              <button
                onClick={logout}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
            {success}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                  <span className="text-blue-600 text-lg">📧</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Aliases</p>
                <p className="text-2xl font-semibold text-gray-900">{aliases.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                  <span className="text-green-600 text-lg">📬</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Emails</p>
                <p className="text-2xl font-semibold text-gray-900">{inboxStats.totalEmails}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-md flex items-center justify-center">
                  <span className="text-orange-600 text-lg">📮</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Unread Emails</p>
                <div className="flex items-center">
                  <p className="text-2xl font-semibold text-gray-900">{inboxStats.unreadCount}</p>
                  {inboxStats.unreadCount > 0 && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      New
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/dashboard/inbox"
                className="relative group bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 hover:border-blue-300 rounded-lg p-4 transition-all duration-200"
              >
                <div className="flex items-center justify-center mb-3">
                  <span className="text-3xl">📬</span>
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-900">View Inbox</p>
                  <p className="text-sm text-gray-600 mt-1">Check received emails</p>
                </div>
                {inboxStats.unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform bg-red-600 rounded-full">
                    {inboxStats.unreadCount}
                  </span>
                )}
              </Link>

              <Link
                href="/dashboard/send"
                className="group bg-green-50 hover:bg-green-100 border-2 border-green-200 hover:border-green-300 rounded-lg p-4 transition-all duration-200"
              >
                <div className="flex items-center justify-center mb-3">
                  <span className="text-3xl">✉️</span>
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-900">Send Email</p>
                  <p className="text-sm text-gray-600 mt-1">Compose new email</p>
                </div>
              </Link>

              <button
                onClick={() => document.getElementById('create-alias-form').scrollIntoView({ behavior: 'smooth' })}
                className="group bg-purple-50 hover:bg-purple-100 border-2 border-purple-200 hover:border-purple-300 rounded-lg p-4 transition-all duration-200"
              >
                <div className="flex items-center justify-center mb-3">
                  <span className="text-3xl">➕</span>
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-900">Create Alias</p>
                  <p className="text-sm text-gray-600 mt-1">Add new email alias</p>
                </div>
              </button>

              <div className="group bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 hover:border-gray-300 rounded-lg p-4 transition-all duration-200">
                <div className="flex items-center justify-center mb-3">
                  <span className="text-3xl">📊</span>
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-900">Analytics</p>
                  <p className="text-sm text-gray-600 mt-1">Coming soon</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create New Alias */}
        <div id="create-alias-form" className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Create New Alias</h3>
            <p className="mt-1 text-sm text-gray-600">
              Create a new email alias to receive emails at a custom address
            </p>
          </div>
          <div className="p-6">
            <form onSubmit={createAlias} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label htmlFor="alias-input" className="block text-sm font-medium text-gray-700 mb-2">
                    Alias Name
                  </label>
                  <input
                    id="alias-input"
                    type="text"
                    placeholder="Enter alias name (e.g., support, contact)"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <span className="text-gray-500 px-3 py-2 bg-gray-50 border border-l-0 border-gray-300 rounded-r-md">
                    @{process.env.NEXT_PUBLIC_MAILGUN_DOMAIN || 'yourdomain.com'}
                  </span>
                </div>
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Create Alias
              </button>
            </form>
          </div>
        </div>

        {/* Email Aliases List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Your Email Aliases</h3>
              <span className="text-sm text-gray-500">
                {aliases.length} alias{aliases.length !== 1 ? 'es' : ''}
              </span>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {aliases.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <span className="text-4xl mb-4 block">📭</span>
                <p className="text-gray-500 mb-4">No aliases created yet.</p>
                <p className="text-sm text-gray-400">
                  Create your first alias to start receiving emails at custom addresses.
                </p>
              </div>
            ) : (
              aliases.map((alias) => (
                <div key={alias._id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">
                              {alias.aliasEmail.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {alias.aliasEmail}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            Forwards to: {alias.realEmail}
                          </p>
                          <div className="flex items-center mt-1 space-x-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                            <span className="text-xs text-gray-400">
                              Created {new Date(alias.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Link
                        href={`/dashboard/inbox?alias=${alias.aliasEmail}`}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        📬 Inbox
                      </Link>
                      <Link
                        href={`/dashboard/send?alias=${alias.aliasEmail}`}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        ✉️ Send
                      </Link>
                      <button
                        onClick={() => deleteAlias(alias._id)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}












// 'use client';
// import { useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import Link from 'next/link';

// export default function Dashboard() {
//   const [user, setUser] = useState(null);
//   const [aliases, setAliases] = useState([]);
//   const [newAlias, setNewAlias] = useState('');
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');
//   const [success, setSuccess] = useState('');
//   const [inboxStats, setInboxStats] = useState({ unreadCount: 0, totalEmails: 0 });
//   const router = useRouter();

//   useEffect(() => {
//     fetchUserData();
//     fetchAliases();
//     fetchInboxStats();
//   }, []);

//   const fetchUserData = async () => {
//     try {
//       const response = await fetch('/api/user');
//       if (response.ok) {
//         const userData = await response.json();
//         setUser(userData);
//       } else {
//         router.push('/signin');
//       }
//     } catch (error) {
//       console.error('Error fetching user data:', error);
//     }
//     setLoading(false);
//   };

//   const fetchAliases = async () => {
//     try {
//       const response = await fetch('/api/aliases');
//       if (response.ok) {
//         const aliasData = await response.json();
//         setAliases(aliasData);
//       }
//     } catch (error) {
//       console.error('Error fetching aliases:', error);
//     }
//   };

//   const fetchInboxStats = async () => {
//     try {
//       const response = await fetch('/api/inbox?limit=1');
//       if (response.ok) {
//         const data = await response.json();
//         setInboxStats({
//           unreadCount: data.unreadCount || 0,
//           totalEmails: data.pagination?.totalCount || 0
//         });
//       }
//     } catch (error) {
//       console.error('Error fetching inbox stats:', error);
//     }
//   };

//   const createAlias = async (e) => {
//     e.preventDefault();
//     setError('');
//     setSuccess('');

//     try {
//       const response = await fetch('/api/aliases', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ alias: newAlias })
//       });

//       if (response.ok) {
//         setSuccess('Alias created successfully!');
//         setNewAlias('');
//         fetchAliases();
//       } else {
//         const data = await response.json();
//         setError(data.error || 'Failed to create alias');
//       }
//     } catch (error) {
//       setError('Network error. Please try again.');
//     }
//   };

//   const deleteAlias = async (aliasId) => {
//     if (!confirm('Are you sure you want to delete this alias?')) return;

//     try {
//       const response = await fetch(`/api/aliases/${aliasId}`, {
//         method: 'DELETE'
//       });

//       if (response.ok) {
//         setSuccess('Alias deleted successfully!');
//         fetchAliases();
//       } else {
//         setError('Failed to delete alias');
//       }
//     } catch (error) {
//       setError('Network error. Please try again.');
//     }
//   };

//   