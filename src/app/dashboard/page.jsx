'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [aliases, setAliases] = useState([]);
  const [reverseAliases, setReverseAliases] = useState([]);
  const [activities, setActivities] = useState([]);
  const [newAlias, setNewAlias] = useState('');
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState('member');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inboxStats, setInboxStats] = useState({ unreadCount: 0, totalEmails: 0 });
  const [toggleLoading, setToggleLoading] = useState({});
  const [activeTab, setActiveTab] = useState('aliases');
  const [managingAliasId, setManagingAliasId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchUserData();
    fetchAliases();
    fetchInboxStats();
    fetchReverseAliases();
    fetchActivities();
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

  const fetchReverseAliases = async () => {
    try {
      const response = await fetch('/api/reverse-aliases');
      if (response.ok) {
        const data = await response.json();
        setReverseAliases(data);
      }
    } catch (error) {
      console.error('Error fetching reverse aliases:', error);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/shared-activities');
      if (response.ok) {
        const data = await response.json();
        setActivities(data);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
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

    // Check alias limit for free users
    if (user?.plan !== 'pro' && aliases.filter(a => !a.isCollaborative).length >= 5) {
      setError('Free users can create maximum 5 personal aliases. Upgrade to Pro for unlimited aliases.');
      return;
    }

    try {
      const response = await fetch('/api/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: newAlias, isCollaborative })
      });

      if (response.ok) {
        setSuccess('Alias created successfully!');
        setNewAlias('');
        setIsCollaborative(false);
        fetchAliases();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create alias');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  const toggleAliasStatus = async (aliasId, currentStatus) => {
    setToggleLoading(prev => ({ ...prev, [aliasId]: true }));
    setError('');

    try {
      const response = await fetch('/api/aliases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aliasId,
          isActive: !currentStatus
        })
      });

      if (response.ok) {
        setSuccess(`Alias ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
        fetchAliases();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update alias status');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setToggleLoading(prev => ({ ...prev, [aliasId]: false }));
    }
  };

  const deleteAlias = async (aliasId) => {
    if (!confirm('Are you sure you want to delete this alias? This action cannot be undone.')) return;

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

  const addCollaborator = async (aliasId, email, role) => {
    try {
      const response = await fetch('/api/aliases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aliasId,
          action: 'addCollaborator',
          userEmail: email,
          role
        })
      });

      if (response.ok) {
        setAddEmail('');
        setAddRole('member');
        fetchAliases();
        fetchActivities();
        setSuccess('Collaborator added successfully!');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add collaborator');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  const removeCollaborator = async (aliasId, collaboratorId) => {
    if (!confirm('Are you sure you want to remove this collaborator?')) return;

    try {
      const response = await fetch('/api/aliases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aliasId,
          action: 'removeCollaborator',
          collaboratorId
        })
      });

      if (response.ok) {
        fetchAliases();
        fetchActivities();
        setSuccess('Collaborator removed successfully!');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to remove collaborator');
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

  const getActivityText = (act) => {
    switch (act.type) {
      case 'sent':
        return `Email sent to ${act.data.to}: ${act.data.subject}`;
      case 'added_collaborator':
        return `Added ${act.data.addedUserEmail} as ${act.data.role}`;
      case 'removed_collaborator':
        return `Removed ${act.data.removedUserEmail}`;
      default:
        return 'Activity logged';
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

  const isPro = user?.plan === 'pro';
  const personalAliases = aliases.filter(a => !a.isCollaborative);
  const collaborativeAliases = aliases.filter(a => a.isCollaborative);
  const aliasLimit = isPro ? 'Unlimited' : '5';
  const canCreateMore = isPro || personalAliases.length < 5;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Plan: <strong className="text-gray-900">{isPro ? 'Pro' : 'Free'}</strong>
                <span className="text-gray-500 ml-2">({personalAliases.length}/{aliasLimit} personal aliases)</span>
              </div>
              {!isPro && (
                <button
                  onClick={upgradeToPro}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors"
                >
                  Upgrade to Pro
                </button>
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
                <p className="text-2xl font-semibold text-gray-900">
                  {aliases.length}
                  {!isPro && <span className="text-sm text-gray-500 ml-1">/ 5 personal</span>}
                </p>
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

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('aliases')}
                className={`${activeTab === 'aliases'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Aliases
              </button>
              <button
                onClick={() => setActiveTab('reverse')}
                className={`${activeTab === 'reverse'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Reverse Aliases
              </button>
            </nav>
          </div>
        </div>

        {activeTab === 'aliases' && (
          <>
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
                    disabled={!canCreateMore}
                  >
                    <div className="flex items-center justify-center mb-3">
                      <span className="text-3xl">➕</span>
                    </div>
                    <div className="text-center">
                      <p className={`font-medium ${canCreateMore ? 'text-gray-900' : 'text-gray-400'}`}>
                        Create Alias
                      </p>
                      <p className={`text-sm mt-1 ${canCreateMore ? 'text-gray-600' : 'text-gray-400'}`}>
                        {canCreateMore ? 'Add new email alias' : 'Upgrade for more'}
                      </p>
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
                  {!isPro && (
                    <span className="block mt-1 text-amber-600 font-medium">
                      Free plan: {personalAliases.length}/5 personal aliases used. Upgrade to Pro for unlimited aliases and collaborative features.
                    </span>
                  )}
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
                        disabled={!canCreateMore}
                        required
                      />
                    </div>
                    <div className="flex items-end">
                      <span className="text-gray-500 px-3 py-2 bg-gray-50 border border-l-0 border-gray-300 rounded-r-md">
                        @{process.env.NEXT_PUBLIC_MAILGUN_DOMAIN || 'yourdomain.com'}
                      </span>
                    </div>
                  </div>
                  {isPro && (
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isCollaborative}
                          onChange={(e) => setIsCollaborative(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        <span className="ml-2 text-sm text-gray-700">Make this a collaborative alias (share with team)</span>
                      </label>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={!canCreateMore || !newAlias}
                    className={`w-full sm:w-auto font-medium py-2 px-4 rounded-md transition-colors ${canCreateMore && newAlias
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                  >
                    {canCreateMore ? 'Create Alias' : 'Upgrade to create more aliases'}
                  </button>
                </form>
              </div>
            </div>

            {/* Email Aliases List */}
            <div className="bg-white rounded-lg shadow-sm border mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Your Email Aliases</h3>
                  <span className="text-sm text-gray-500">
                    {aliases.length} alias{aliases.length !== 1 ? 'es' : ''}
                    {!isPro && <span className="text-amber-600 font-medium ml-2">({personalAliases.length}/5 personal)</span>}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-gray-200">
                {aliases.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <span className="text-4xl mb-4 block">🔭</span>
                    <p className="text-gray-500 mb-4">No aliases created yet.</p>
                    <p className="text-sm text-gray-400">
                      Create your first alias to start receiving emails at custom addresses.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Personal Aliases */}
                    {personalAliases.length > 0 && (
                      <div className="px-6 py-4">
                        <h4 className="text-md font-medium text-gray-900 mb-4">Personal Aliases</h4>
                        {personalAliases.map((alias) => (
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
                                      <div className="flex items-center space-x-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${alias.isActive !== false
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                          }`}>
                                          {alias.isActive !== false ? 'Active' : 'Inactive'}
                                        </span>
                                        <button
                                          onClick={() => toggleAliasStatus(alias._id, alias.isActive !== false)}
                                          disabled={toggleLoading[alias._id]}
                                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${alias.isActive !== false ? 'bg-blue-600' : 'bg-gray-200'
                                            } ${toggleLoading[alias._id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                          title={`Click to ${alias.isActive !== false ? 'deactivate' : 'activate'} alias`}
                                        >
                                          <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${alias.isActive !== false ? 'translate-x-5' : 'translate-x-0'
                                              }`}
                                          />
                                          {toggleLoading[alias._id] && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                              <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                          )}
                                        </button>
                                      </div>
                                      <span className="text-xs text-gray-400">
                                        Created {new Date(alias.createdAt).toLocaleDateString()}
                                      </span>
                                      <div className="space-y-1 text-xs text-gray-600">
                                        <p>Sent: {alias.emailsSent || 0}</p>
                                        <p>Received: {alias.emailsReceived || 0}</p>
                                      </div>
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
                        ))}
                      </div>
                    )}

                    {/* Collaborative Aliases */}
                    {collaborativeAliases.length > 0 && (
                      <div className="px-6 py-4">
                        <h4 className="text-md font-medium text-gray-900 mb-4">Collaborative Aliases {isPro ? '' : '(Pro Feature)'}</h4>
                        {collaborativeAliases.map((alias) => {
                          const isOwner = alias.ownerId?.toString() === user?._id?.toString();
                          const aliasActivities = activities.filter(act => act.aliasId?.toString() === alias._id?.toString()).slice(0, 3);
                          return (
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
                                      <p className="text-xs text-gray-400">
                                        Owner: {alias.ownerId?.toString().slice(0, 8)}...
                                      </p>
                                      <div className="flex items-center mt-1 space-x-4">
                                        <div className="flex items-center space-x-2">
                                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${alias.isActive !== false
                                              ? 'bg-green-100 text-green-800'
                                              : 'bg-red-100 text-red-800'
                                            }`}>
                                            {alias.isActive !== false ? 'Active' : 'Inactive'}
                                          </span>
                                          {isOwner && (
                                            <button
                                              onClick={() => toggleAliasStatus(alias._id, alias.isActive !== false)}
                                              disabled={toggleLoading[alias._id]}
                                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${alias.isActive !== false ? 'bg-blue-600' : 'bg-gray-200'
                                                } ${toggleLoading[alias._id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                              title={`Click to ${alias.isActive !== false ? 'deactivate' : 'activate'} alias`}
                                            >
                                              <span
                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${alias.isActive !== false ? 'translate-x-5' : 'translate-x-0'
                                                  }`}
                                              />
                                              {toggleLoading[alias._id] && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                  <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                                </div>
                                              )}
                                            </button>
                                          )}
                                        </div>
                                        <span className="text-xs text-gray-400">
                                          Created {new Date(alias.createdAt).toLocaleDateString()}
                                        </span>
                                        <div className="space-y-1 text-xs text-gray-600">
                                          <p>Sent: {alias.emailsSent || 0}</p>
                                          <p>Received: {alias.emailsReceived || 0}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  {/* Collaborators */}
            

                                  {/* FIXED: Collaborators section - now shows user names */}
                                  <div className="mt-4">
                                    <h4 className="font-medium text-sm text-gray-900 mb-2">Collaborators</h4>
                                    <div className="space-y-1">
                                      {alias.collaborators?.map((c) => (
                                        <div key={c.userId} className="flex items-center justify-between text-sm">
                                          <span className="text-gray-600">
                                            {c.userDetails?.name || c.userDetails?.email || 'Unknown User'} ({c.role})
                                          </span>
                                          {isOwner && (
                                            <button
                                              onClick={() => removeCollaborator(alias._id, c.userId)}
                                              className="text-red-600 hover:text-red-800 text-xs"
                                            >
                                              Remove
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                      {alias.collaborators?.length === 0 && (
                                        <p className="text-gray-500 text-sm">No collaborators yet</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* FIXED: Owner display section */}
                                  <div className="mt-2">
                                    <p className="text-xs text-gray-400">
                                      Owner: {alias.owner?.[0]?.name || alias.owner?.[0]?.email || 'Unknown'}
                                    </p>
                                  </div>
                                  {/* Add Collaborator Form */}
                                  {isOwner && (
                                    <div className="mt-4 p-3 bg-gray-50 rounded">
                                      <h4 className="font-medium text-sm text-gray-900 mb-2">Add Collaborator</h4>
                                      <div className="flex space-x-2">
                                        <input
                                          type="email"
                                          placeholder="User email"
                                          value={managingAliasId === alias._id ? addEmail : ''}
                                          onChange={(e) => setAddEmail(e.target.value)}
                                          className="flex-1 px-3 py-1 border rounded text-sm"
                                        />
                                        <select
                                          value={managingAliasId === alias._id ? addRole : 'member'}
                                          onChange={(e) => setAddRole(e.target.value)}
                                          className="px-3 py-1 border rounded text-sm"
                                        >
                                          <option value="member">Member</option>
                                          <option value="viewer">Viewer</option>
                                        </select>
                                        <button
                                          onClick={() => {
                                            if (managingAliasId === alias._id) {
                                              addCollaborator(alias._id, addEmail, addRole);
                                            } else {
                                              setManagingAliasId(alias._id);
                                            }
                                          }}
                                          className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                        >
                                          {managingAliasId === alias._id ? 'Add' : 'Edit'}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  {/* Recent Activity */}
                                  {aliasActivities.length > 0 && (
                                    <div className="mt-4">
                                      <h4 className="font-medium text-sm text-gray-900 mb-2">Recent Activity</h4>
                                      <div className="space-y-1 text-xs text-gray-600">
                                        {aliasActivities.map((act) => (
                                          <p key={act._id}>{getActivityText(act)}</p>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                  <Link
                                    href={`/dashboard/inbox?alias=${alias.aliasEmail}`}
                                    className={`inline-flex items-center px-3 py-1.5 border rounded-md text-sm leading-4 font-medium transition-colors ${isOwner
                                        ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                                        : 'border-transparent text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                                      }`}
                                  >
                                    {isOwner ? '📬 Manage Inbox' : '📬 View Inbox'}
                                  </Link>
                                  <Link
                                    href={`/dashboard/send?alias=${alias.aliasEmail}`}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                  >
                                    ✉️ Send
                                  </Link>
                                  {isOwner && (
                                    <button
                                      onClick={() => deleteAlias(alias._id)}
                                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                    >
                                      🗑️ Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* Reverse Aliases Tab */}
        {activeTab === 'reverse' && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Reverse Aliases</h3>
              <button onClick={() => setActiveTab('aliases')} className="text-sm text-blue-600 hover:underline">
                Back to Aliases
              </button>
            </div>
            <div className="p-6">
              {reverseAliases.length === 0 ? (
                <p className="text-gray-500">No reverse aliases yet.</p>
              ) : (
                reverseAliases.map(ra => (
                  <div key={ra._id} className="border-b py-4 last:border-b-0">
                    <p className="text-sm font-medium text-gray-900">{ra.recipientEmail} via {ra.alias.aliasEmail}</p>
                    <p className="text-sm text-gray-500">Sent: {ra.emailsSent || 0}, Received: {ra.emailsReceived || 0}</p>
                    <button
                      onClick={() => {/* Implement deactivate logic */ }}
                      className="mt-2 text-red-600 text-sm hover:text-red-800"
                    >
                      Deactivate
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}





