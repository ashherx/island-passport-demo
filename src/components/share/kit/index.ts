/**
 * The share kit: everything the partner flow, the traveler flow and the recipient page are built
 * from. Reference with props and examples: docs/agents/p3-kit.md
 */
export { Avatar, SampleTag, ShareShell, SkButton, StepHeader, skRootClass, type ShareShellProps, type SkButtonProps, type StepDef, type StepHeaderProps } from "./primitives";
export { QrCode, qrMatrix, type QrCodeProps } from "./QrCode";
export { LinkField, type LinkFieldProps } from "./LinkField";
export { CaptionEditor, composeCaption, type CaptionEditorProps } from "./CaptionEditor";
export { POST_ASPECT, POST_FORMATS, PostPreview, authorOf, type PostAuthor, type PostFormat, type PostPreviewProps } from "./PostPreview";
export { IslandReel, type IslandReelHandle, type IslandReelProps } from "./IslandReel";
export { ShareSheet, type ShareAction, type ShareSheetProps } from "./ShareSheet";
export { POST_IMAGE_SIZE, downloadBlob, drawQr, isInAppBrowser, renderPostImage, type PostImageSpec } from "./render";
export { copyText, useCopy, usePrefersReducedMotion, useShareTarget, type CopyState } from "./hooks";
export * from "./icons";
