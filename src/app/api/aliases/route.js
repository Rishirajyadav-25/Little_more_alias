import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb.js';
import { verifyToken } from '../../../lib/auth.js';
import { ObjectId } from 'mongodb';
import { PLANS } from '../../../lib/plans.js';

export async function GET(request) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const client = await clientPromise;
    const db = client.db();
    
    // FIXED: Fetch all accessible aliases with populated collaborator names
    const aliases = await db.collection('aliases').aggregate([
      {
        $match: {
          $or: [
            { ownerId: new ObjectId(decoded.userId) },
            { 'collaborators.userId': new ObjectId(decoded.userId) }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'ownerId',
          foreignField: '_id',
          as: 'owner',
          pipeline: [{ $project: { name: 1, email: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'collaborators.userId',
          foreignField: '_id',
          as: 'collaboratorUsers',
          pipeline: [{ $project: { name: 1, email: 1 } }]
        }
      },
      {
        $addFields: {
          collaborators: {
            $map: {
              input: '$collaborators',
              as: 'collab',
              in: {
                userId: '$$collab.userId',
                role: '$$collab.role',
                userDetails: {
                  $first: {
                    $filter: {
                      input: '$collaboratorUsers',
                      cond: { $eq: ['$$this._id', '$$collab.userId'] }
                    }
                  }
                }
              }
            }
          }
        }
      },
      {
        $project: {
          collaboratorUsers: 0 // Remove the temporary field
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]).toArray();

    return NextResponse.json(aliases, { status: 200 });
  } catch (error) {
    console.error('Get aliases error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const { alias, isCollaborative = false } = await request.json();

    // Fetch user to check plan
    const client = await clientPromise;
    const db = client.db();
    const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });

    if (isCollaborative && user.plan !== 'pro') {
      return NextResponse.json({ error: 'Collaborative aliases are a Pro feature. Upgrade your plan.' }, { status: 403 });
    }

    // Validate alias input
    if (!alias || typeof alias !== 'string') {
      return NextResponse.json({ error: 'Alias is required' }, { status: 400 });
    }

    const cleanAlias = alias.trim().toLowerCase();
    
    if (cleanAlias.length === 0) {
      return NextResponse.json({ error: 'Alias cannot be empty' }, { status: 400 });
    }

    // Validate alias format
    if (!/^[a-zA-Z0-9._-]+$/.test(cleanAlias)) {
      return NextResponse.json({ 
        error: 'Invalid alias format. Use only letters, numbers, dots, hyphens and underscores.' 
      }, { status: 400 });
    }

    // Check length constraints
    if (cleanAlias.length < 2 || cleanAlias.length > 50) {
      return NextResponse.json({ 
        error: 'Alias must be between 2 and 50 characters long' 
      }, { status: 400 });
    }

    // Check for reserved aliases
    const reservedAliases = [
      'admin', 'administrator', 'root', 'postmaster', 'webmaster',
      'hostmaster', 'abuse', 'noreply', 'no-reply', 'support',
      'info', 'contact', 'sales', 'marketing', 'help', 'api',
      'www', 'mail', 'email', 'ftp', 'test', 'staging', 'dev'
    ];
    
    if (reservedAliases.includes(cleanAlias)) {
      return NextResponse.json({ 
        error: 'Reserved alias name' 
      }, { status: 400 });
    }

    // Check alias limit
    const userAliasCount = await db.collection('aliases').countDocuments({
      ownerId: new ObjectId(decoded.userId)
    });

    const plan = user.plan === 'pro' ? { aliasLimit: Infinity } : { aliasLimit: 5 };
    if (userAliasCount >= plan.aliasLimit) {
      return NextResponse.json({ 
        error: `Alias limit reached. ${user.plan === 'pro' ? 'Contact support.' : 'Upgrade to Pro for unlimited aliases.'}` 
      }, { status: 403 });
    }

    // Check if alias already exists
    const existingAlias = await db.collection('aliases').findOne({
      aliasEmail: `${cleanAlias}@${process.env.NEXT_PUBLIC_MAILGUN_DOMAIN}`
    });

    if (existingAlias) {
      return NextResponse.json({ 
        error: 'Alias already exists' 
      }, { status: 409 });
    }

    const aliasEmail = `${cleanAlias}@${process.env.NEXT_PUBLIC_MAILGUN_DOMAIN || 'yourdomain.com'}`;

    const newAlias = {
      userId: new ObjectId(decoded.userId), // For legacy compatibility
      ownerId: new ObjectId(decoded.userId),
      isCollaborative,
      collaborators: [],
      aliasEmail: aliasEmail,
      aliasName: cleanAlias,
      realEmail: user.email,
      isActive: true,
      emailsSent: 0,
      emailsReceived: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('aliases').insertOne(newAlias);

    const createdAlias = {
      ...newAlias,
      _id: result.insertedId
    };

    return NextResponse.json({
      message: 'Alias created successfully',
      alias: createdAlias
    }, { status: 201 });

  } catch (error) {
    console.error('Create alias error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const body = await request.json();
    const { aliasId, isActive, action, userEmail, role, collaboratorId } = body;

    if (!aliasId || !ObjectId.isValid(aliasId)) {
      return NextResponse.json({ error: 'Valid alias ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    // Fetch the alias to verify access
    const alias = await db.collection('aliases').findOne({
      _id: new ObjectId(aliasId),
      $or: [
        { ownerId: new ObjectId(decoded.userId) },
        { 'collaborators.userId': new ObjectId(decoded.userId) }
      ]
    });

    if (!alias) {
      return NextResponse.json({ error: 'Alias not found or unauthorized' }, { status: 404 });
    }

    if (action === 'addCollaborator') {
      // Only owner can add collaborators, and only for collaborative aliases
      if (alias.ownerId.toString() !== decoded.userId || !alias.isCollaborative) {
        return NextResponse.json({ error: 'Only owners can manage collaborators' }, { status: 403 });
      }

      if (!userEmail || !role || !['member', 'viewer'].includes(role)) {
        return NextResponse.json({ error: 'Valid user email and role (member/viewer) required' }, { status: 400 });
      }

      // Find target user by exact email match (case insensitive)
      const targetUser = await db.collection('users').findOne({
        email: { $regex: new RegExp(`^${userEmail.trim().toLowerCase()}$`, 'i') }
      });

      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Check if already a collaborator
      if (alias.collaborators.some(c => c.userId.toString() === targetUser._id.toString())) {
        return NextResponse.json({ error: 'User is already a collaborator' }, { status: 400 });
      }

      // Add collaborator
      const result = await db.collection('aliases').updateOne(
        { _id: new ObjectId(aliasId) },
        { 
          $push: { 
            collaborators: { 
              userId: new ObjectId(targetUser._id), 
              role 
            } 
          },
          $set: { updatedAt: new Date() }
        }
      );

      if (result.modifiedCount === 0) {
        return NextResponse.json({ error: 'Failed to add collaborator' }, { status: 500 });
      }

      // Log activity
      await db.collection('shared_activities').insertOne({
        aliasId: new ObjectId(aliasId),
        type: 'added_collaborator',
        userId: new ObjectId(decoded.userId),
        data: { 
          addedUserId: targetUser._id, 
          addedUserEmail: targetUser.email, 
          role 
        },
        createdAt: new Date()
      });

      // FIXED: Fetch updated alias with populated user details
      const updatedAlias = await db.collection('aliases').aggregate([
        { $match: { _id: new ObjectId(aliasId) } },
        {
          $lookup: {
            from: 'users',
            localField: 'ownerId',
            foreignField: '_id',
            as: 'owner',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'collaborators.userId',
            foreignField: '_id',
            as: 'collaboratorUsers',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        {
          $addFields: {
            collaborators: {
              $map: {
                input: '$collaborators',
                as: 'collab',
                in: {
                  userId: '$$collab.userId',
                  role: '$$collab.role',
                  userDetails: {
                    $first: {
                      $filter: {
                        input: '$collaboratorUsers',
                        cond: { $eq: ['$$this._id', '$$collab.userId'] }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          $project: {
            collaboratorUsers: 0
          }
        }
      ]).next();

      return NextResponse.json({
        message: 'Collaborator added successfully',
        alias: updatedAlias
      });

    } else if (action === 'removeCollaborator') {
      // Only owner can remove
      if (alias.ownerId.toString() !== decoded.userId || !alias.isCollaborative) {
        return NextResponse.json({ error: 'Only owners can manage collaborators' }, { status: 403 });
      }

      if (!collaboratorId || !ObjectId.isValid(collaboratorId)) {
        return NextResponse.json({ error: 'Valid collaborator ID required' }, { status: 400 });
      }

      // Find the collaborator to get email for activity
      const collaborator = alias.collaborators.find(c => c.userId.toString() === collaboratorId);
      if (!collaborator) {
        return NextResponse.json({ error: 'Collaborator not found' }, { status: 404 });
      }

      const removedUser = await db.collection('users').findOne({ _id: new ObjectId(collaboratorId) });
      if (!removedUser) {
        return NextResponse.json({ error: 'Removed user not found' }, { status: 404 });
      }

      // Remove collaborator
      const result = await db.collection('aliases').updateOne(
        { _id: new ObjectId(aliasId) },
        { 
          $pull: { collaborators: { userId: new ObjectId(collaboratorId) } },
          $set: { updatedAt: new Date() }
        }
      );

      if (result.modifiedCount === 0) {
        return NextResponse.json({ error: 'Failed to remove collaborator' }, { status: 500 });
      }

      // Log activity
      await db.collection('shared_activities').insertOne({
        aliasId: new ObjectId(aliasId),
        type: 'removed_collaborator',
        userId: new ObjectId(decoded.userId),
        data: { 
          removedUserId: collaboratorId, 
          removedUserEmail: removedUser.email 
        },
        createdAt: new Date()
      });

      // FIXED: Fetch updated alias with populated user details
      const updatedAlias = await db.collection('aliases').aggregate([
        { $match: { _id: new ObjectId(aliasId) } },
        {
          $lookup: {
            from: 'users',
            localField: 'ownerId',
            foreignField: '_id',
            as: 'owner',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'collaborators.userId',
            foreignField: '_id',
            as: 'collaboratorUsers',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        {
          $addFields: {
            collaborators: {
              $map: {
                input: '$collaborators',
                as: 'collab',
                in: {
                  userId: '$$collab.userId',
                  role: '$$collab.role',
                  userDetails: {
                    $first: {
                      $filter: {
                        input: '$collaboratorUsers',
                        cond: { $eq: ['$$this._id', '$$collab.userId'] }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          $project: {
            collaboratorUsers: 0
          }
        }
      ]).next();

      return NextResponse.json({
        message: 'Collaborator removed successfully',
        alias: updatedAlias
      });

    } else {
      // Default: Toggle isActive (only owner for collaborative, anyone for personal)
      if (typeof isActive !== 'boolean') {
        return NextResponse.json({ error: 'isActive must be a boolean value' }, { status: 400 });
      }

      if (alias.isCollaborative && alias.ownerId.toString() !== decoded.userId) {
        return NextResponse.json({ error: 'Only owners can toggle collaborative aliases' }, { status: 403 });
      }

      const result = await db.collection('aliases').updateOne(
        { 
          _id: new ObjectId(aliasId),
          $or: [
            { ownerId: new ObjectId(decoded.userId) },
            { 'collaborators.userId': new ObjectId(decoded.userId) }
          ]
        },
        { 
          $set: { 
            isActive: isActive,
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Alias not found or unauthorized' }, { status: 404 });
      }

      // FIXED: Get updated alias with populated user details
      const updatedAlias = await db.collection('aliases').aggregate([
        { $match: { _id: new ObjectId(aliasId) } },
        {
          $lookup: {
            from: 'users',
            localField: 'ownerId',
            foreignField: '_id',
            as: 'owner',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'collaborators.userId',
            foreignField: '_id',
            as: 'collaboratorUsers',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        {
          $addFields: {
            collaborators: {
              $map: {
                input: '$collaborators',
                as: 'collab',
                in: {
                  userId: '$$collab.userId',
                  role: '$$collab.role',
                  userDetails: {
                    $first: {
                      $filter: {
                        input: '$collaboratorUsers',
                        cond: { $eq: ['$$this._id', '$$collab.userId'] }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          $project: {
            collaboratorUsers: 0
          }
        }
      ]).next();

      return NextResponse.json({
        message: `Alias ${isActive ? 'activated' : 'deactivated'} successfully`,
        alias: updatedAlias
      }, { status: 200 });
    }

  } catch (error) {
    console.error('Update alias error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}