import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { requireAdmin } from '@/lib/auth/middleware';
import { UpdatePublicTagRequest } from '@/types/quizSelector.types';
import { ObjectId } from 'mongodb';

// PUT /api/tags/public/[tagId] - 编辑公共标签
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tagId: string }> },
) {
  const { tagId } = await params;
  try {
    const session = await getServerSession(authOptions);

    // 使用新的权限验证工具
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { db } = await connectToDatabase();
    const updateData: UpdatePublicTagRequest = await request.json();

    // 验证标签ID
    if (!ObjectId.isValid(tagId)) {
      return NextResponse.json({ error: 'Invalid tag ID' }, { status: 400 });
    }

    // 检查标签是否存在
    const existingTag = await db.collection('publictags').findOne({
      _id: new ObjectId(tagId),
    });

    if (!existingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // 如果更新名称，检查是否与其他标签冲突
    if (updateData.name && updateData.name !== existingTag.name) {
      const duplicateTag = await db.collection('publictags').findOne({
        name: updateData.name.trim(),
        _id: { $ne: new ObjectId(tagId) },
      });

      if (duplicateTag) {
        return NextResponse.json(
          { error: 'Tag with this name already exists' },
          { status: 409 },
        );
      }
    }

    // 构建更新对象
    const updateObject: any = {
      updatedAt: new Date(),
    };

    if (updateData.name !== undefined) {
      updateObject.name = updateData.name.trim();
    }
    if (updateData.description !== undefined) {
      updateObject.description = updateData.description?.trim();
    }
    if (updateData.category !== undefined) {
      updateObject.category = updateData.category?.trim();
    }
    if (updateData.color !== undefined) {
      updateObject.color = updateData.color;
    }
    if (updateData.isActive !== undefined) {
      updateObject.isActive = updateData.isActive;
    }

    const result = await db
      .collection('publictags')
      .updateOne({ _id: new ObjectId(tagId) }, { $set: updateObject });

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to update tag or no changes made' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tag updated successfully',
    });
  } catch (error) {
    console.error('Error updating public tag:', error);
    return NextResponse.json(
      { error: 'Failed to update public tag' },
      { status: 500 },
    );
  }
}

// DELETE /api/tags/public/[tagId] - 删除公共标签
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tagId: string }> },
) {
  const { tagId } = await params;
  try {
    const session = await getServerSession(authOptions);

    // 使用新的权限验证工具
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { db } = await connectToDatabase();

    // 验证标签ID
    if (!ObjectId.isValid(tagId)) {
      return NextResponse.json({ error: 'Invalid tag ID' }, { status: 400 });
    }

    // 检查标签是否存在
    const existingTag = await db.collection('publictags').findOne({
      _id: new ObjectId(tagId),
    });

    if (!existingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // 检查标签是否在使用中
    if (existingTag.usageCount > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete tag that is in use',
          usageCount: existingTag.usageCount,
        },
        { status: 400 },
      );
    }

    const result = await db.collection('publictags').deleteOne({
      _id: new ObjectId(tagId),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to delete tag' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tag deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting public tag:', error);
    return NextResponse.json(
      { error: 'Failed to delete public tag' },
      { status: 500 },
    );
  }
}
