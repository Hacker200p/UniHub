import mongoose from 'mongoose'

const { Schema } = mongoose
const bookmarkSchema = new Schema({ userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true }, universityId: { type: String, required: true } }, { timestamps: true, versionKey: false })
bookmarkSchema.index({ userId: 1, resourceId: 1 }, { unique: true })
const viewedSchema = new Schema({ userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true }, universityId: { type: String, required: true }, viewedAt: { type: Date, default: Date.now } }, { timestamps: true, versionKey: false })
viewedSchema.index({ userId: 1, resourceId: 1 }, { unique: true })
viewedSchema.index({ userId: 1, viewedAt: -1 })
export const Bookmark = mongoose.model('Bookmark', bookmarkSchema)
export const RecentlyViewed = mongoose.model('RecentlyViewed', viewedSchema)
