import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const { Schema } = mongoose

const authProviderSchema = new Schema(
  {
    provider: {
      type: String,
      enum: ['google', 'github', 'microsoft'],
      required: true,
    },
    providerUserId: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    linkedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
)

const privacySettingsSchema = new Schema(
  {
    showAvatar: { type: Boolean, default: true },
    showBio: { type: Boolean, default: true },
    showGithub: { type: Boolean, default: true },
    showLinkedin: { type: Boolean, default: true },
    showAcademicInfo: { type: Boolean, default: true },
  },
  { _id: false },
)

const userSchema = new Schema(
  {
    universityId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, default: null, select: false },
    role: { type: String, enum: ['STUDENT', 'MODERATOR', 'ADMIN'], default: 'STUDENT', index: true },
    programId: { type: Schema.Types.ObjectId, ref: 'Program' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    semesterId: { type: Schema.Types.ObjectId, ref: 'Semester' },
    isActive: { type: Boolean, default: true },
    publicProfile: { type: Boolean, default: true },
    avatarUrl: { type: String, default: '' },
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    githubUrl: { type: String, trim: true, default: '' },
    linkedinUrl: { type: String, trim: true, default: '' },
    authProviders: { type: [authProviderSchema], default: [] },
    privacySettings: { type: privacySettingsSchema, default: () => ({}) },
    resetPasswordHash: { type: String, select: false },
    resetPasswordExpiresAt: { type: Date, select: false },
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
  },
  { timestamps: true, versionKey: false },
)

userSchema.index({ universityId: 1, email: 1 }, { unique: true })
userSchema.index(
  { 'authProviders.provider': 1, 'authProviders.providerUserId': 1 },
  { unique: true, sparse: true },
)

userSchema.methods.comparePassword = function comparePassword(password) {
  if (!this.passwordHash) return Promise.resolve(false)
  return bcrypt.compare(password, this.passwordHash)
}

userSchema.methods.toPublicJSON = function toPublicJSON() {
  const privacy = this.privacySettings || {}
  return {
    id: this._id,
    name: this.name,
    email: this.publicProfile ? this.email : null,
    role: this.role,
    universityId: this.universityId,
    programId: privacy.showAcademicInfo !== false ? this.programId : null,
    branchId: privacy.showAcademicInfo !== false ? this.branchId : null,
    semesterId: privacy.showAcademicInfo !== false ? this.semesterId : null,
    publicProfile: this.publicProfile,
    avatarUrl: privacy.showAvatar !== false ? this.avatarUrl : '',
    bio: privacy.showBio !== false ? this.bio : '',
    githubUrl: privacy.showGithub !== false ? this.githubUrl : '',
    linkedinUrl: privacy.showLinkedin !== false ? this.linkedinUrl : '',
  }
}

userSchema.methods.toPrivateJSON = function toPrivateJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    universityId: this.universityId,
    programId: this.programId,
    branchId: this.branchId,
    semesterId: this.semesterId,
    publicProfile: this.publicProfile,
    avatarUrl: this.avatarUrl,
    bio: this.bio,
    githubUrl: this.githubUrl,
    linkedinUrl: this.linkedinUrl,
    hasPassword: Boolean(this.passwordHash),
    isEmailVerified: Boolean(this.emailVerifiedAt),
    authProviders: (this.authProviders || []).map((p) => ({
      provider: p.provider,
      email: p.email,
      emailVerified: p.emailVerified,
      avatarUrl: p.avatarUrl,
      linkedAt: p.linkedAt,
    })),
    privacySettings: this.privacySettings || {
      showAvatar: true,
      showBio: true,
      showGithub: true,
      showLinkedin: true,
      showAcademicInfo: true,
    },
  }
}

export const User = mongoose.model('User', userSchema)
