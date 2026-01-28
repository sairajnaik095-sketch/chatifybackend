import Group from "../models/Group.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const createGroup = async (req, res) => {
  try {
    const { name, description, memberIds } = req.body;
    const creatorId = req.user._id;

    if (!name || !memberIds || memberIds.length === 0) {
      return res.status(400).json({ message: "Group name and at least one member are required." });
    }

    // Validate member IDs exist
    const membersExist = await User.find({ _id: { $in: memberIds } });
    if (membersExist.length !== memberIds.length) {
      return res.status(400).json({ message: "Some member IDs are invalid." });
    }

    // Include creator in members as admin
    const members = [
      { user: creatorId, role: "admin" },
      ...memberIds.map(id => ({ user: id, role: "member" }))
    ];

    const newGroup = new Group({
      name,
      description,
      creator: creatorId,
      members,
    });

    await newGroup.save();

    // Populate member details
    await newGroup.populate('members.user', 'fullName profilePic');
    await newGroup.populate('creator', 'fullName profilePic');

    res.status(201).json(newGroup);
  } catch (error) {
    console.log("Error in createGroup:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const groups = await Group.find({ "members.user": userId })
      .populate('members.user', 'fullName profilePic')
      .populate('creator', 'fullName profilePic')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    res.status(200).json(groups);
  } catch (error) {
    console.log("Error in getUserGroups:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getGroupById = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findOne({
      _id: groupId,
      "members.user": userId
    })
      .populate('members.user', 'fullName profilePic')
      .populate('creator', 'fullName profilePic');

    if (!group) {
      return res.status(404).json({ message: "Group not found or access denied." });
    }

    res.status(200).json(group);
  } catch (error) {
    console.log("Error in getGroupById:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const addMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user._id;

    if (!memberIds || memberIds.length === 0) {
      return res.status(400).json({ message: "At least one member ID is required." });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check if user is admin
    const userMember = group.members.find(m => m.user.toString() === userId.toString());
    if (!userMember || userMember.role !== "admin") {
      return res.status(403).json({ message: "Only admins can add members." });
    }

    // Validate new member IDs exist
    const membersExist = await User.find({ _id: { $in: memberIds } });
    if (membersExist.length !== memberIds.length) {
      return res.status(400).json({ message: "Some member IDs are invalid." });
    }

    // Check if members are already in group
    const existingMemberIds = group.members.map(m => m.user.toString());
    const newMembers = memberIds.filter(id => !existingMemberIds.includes(id.toString()));

    if (newMembers.length === 0) {
      return res.status(400).json({ message: "All specified users are already members." });
    }

    // Add new members
    const membersToAdd = newMembers.map(id => ({ user: id, role: "member" }));
    group.members.push(...membersToAdd);
    await group.save();

    await group.populate('members.user', 'fullName profilePic');

    res.status(200).json(group);
  } catch (error) {
    console.log("Error in addMembers:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const removeMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check if user is admin or removing themselves
    const userMember = group.members.find(m => m.user.toString() === userId.toString());
    const isAdmin = userMember && userMember.role === "admin";
    const isRemovingSelf = memberId === userId.toString();

    if (!isAdmin && !isRemovingSelf) {
      return res.status(403).json({ message: "Only admins can remove other members." });
    }

    // Cannot remove the creator/admin if there are other members
    if (memberId === group.creator.toString() && group.members.length > 1) {
      return res.status(400).json({ message: "Cannot remove the group creator while other members exist." });
    }

    // Remove member
    group.members = group.members.filter(m => m.user.toString() !== memberId);
    await group.save();

    await group.populate('members.user', 'fullName profilePic');

    res.status(200).json(group);
  } catch (error) {
    console.log("Error in removeMember:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, avatar } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check if user is admin
    const userMember = group.members.find(m => m.user.toString() === userId.toString());
    if (!userMember || userMember.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update group info." });
    }

    // Update fields
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (avatar !== undefined) group.avatar = avatar;

    await group.save();
    await group.populate('members.user', 'fullName profilePic');
    await group.populate('creator', 'fullName profilePic');

    res.status(200).json(group);
  } catch (error) {
    console.log("Error in updateGroup:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // Check if user is member of the group
    const group = await Group.findOne({
      _id: groupId,
      "members.user": userId
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found or access denied." });
    }

    const messages = await Message.find({ groupId })
      .populate('senderId', 'fullName profilePic')
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getGroupMessages:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const sendMessageToGroup = async (req, res) => {
  try {
    const { text, image, audio } = req.body;
    const { groupId } = req.params;
    const senderId = req.user._id;

    if (!text && !image && !audio) {
      return res.status(400).json({ message: "Text, image, or audio is required." });
    }

    // Check if user is member of the group
    const group = await Group.findOne({
      _id: groupId,
      "members.user": senderId
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found or access denied." });
    }

    let imageUrl;
    if (image) {
      if (!image.startsWith('data:image/')) {
        return res.status(400).json({ message: "Invalid image format." });
      }
      imageUrl = image;
    }

    let audioUrl;
    if (audio) {
      if (!audio.startsWith('data:audio/')) {
        return res.status(400).json({ message: "Invalid audio format." });
      }
      audioUrl = audio;
    }

    const newMessage = new Message({
      senderId,
      groupId,
      text,
      image: imageUrl,
      audio: audioUrl,
    });

    await newMessage.save();

    // Update group's lastMessage
    group.lastMessage = newMessage._id;
    await group.save();

    // Populate sender details
    await newMessage.populate('senderId', 'fullName profilePic');

    // Broadcast to all group members except sender
    const memberIds = group.members.map(m => m.user.toString()).filter(id => id !== senderId.toString());

    memberIds.forEach(memberId => {
      const socketId = getReceiverSocketId(memberId);
      if (socketId) {
        io.to(socketId).emit("newGroupMessage", {
          message: newMessage,
          groupId: group._id
        });
      }
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessageToGroup:", error);
    res.status(500).json({ message: "Server error" });
  }
};
