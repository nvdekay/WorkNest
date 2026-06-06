// Danh mục lỗi (xem spec §13). Mỗi entry = { status, message } mặc định.

const ERROR_CODES = Object.freeze({
  BAD_REQUEST:               { status: 400, message: 'Bad request.' },
  INVALID_ID:                { status: 400, message: 'Invalid id format.' },

  UNAUTHENTICATED:           { status: 401, message: 'Authentication required.' },
  TOKEN_EXPIRED:             { status: 401, message: 'Access token expired.' },
  TOKEN_INVALID:             { status: 401, message: 'Token is invalid.' },
  INVALID_CREDENTIALS:       { status: 401, message: 'Invalid credentials.' },

  FORBIDDEN:                 { status: 403, message: 'You do not have permission to perform this action.' },
  INVITATION_EMAIL_MISMATCH: { status: 403, message: 'Invitation email does not match your account.' },
  WORKSPACE_LIMIT_REACHED:   { status: 403, message: 'You have reached the maximum number of owned workspaces.' },

  NOT_FOUND:                 { status: 404, message: 'Resource not found.' },
  WORKSPACE_NOT_FOUND:       { status: 404, message: 'Workspace not found.' },
  PROJECT_NOT_FOUND:         { status: 404, message: 'Project not found.' },
  TASK_NOT_FOUND:            { status: 404, message: 'Task not found.' },
  COMMENT_NOT_FOUND:         { status: 404, message: 'Comment not found.' },
  MEMBER_NOT_FOUND:          { status: 404, message: 'Member not found.' },
  USER_NOT_FOUND:            { status: 404, message: 'User not found.' },

  EMAIL_TAKEN:               { status: 409, message: 'Email is already taken.' },
  ALREADY_MEMBER:            { status: 409, message: 'User is already a member of this workspace.' },
  INVITATION_EXISTS:         { status: 409, message: 'A pending invitation already exists for this email.' },
  INVITATION_NOT_PENDING:    { status: 409, message: 'Invitation is not pending.' },
  PROJECT_KEY_TAKEN:         { status: 409, message: 'Project key already exists in this workspace.' },
  PROJECT_ARCHIVED:          { status: 409, message: 'Project is archived and read-only.' },
  INVALID_STATUS_TRANSITION: { status: 409, message: 'Invalid task status transition for this project.' },
  CANNOT_MODIFY_OWNER:       { status: 409, message: 'Cannot modify the workspace OWNER.' },
  CANNOT_REMOVE_OWNER:       { status: 409, message: 'Cannot remove the workspace OWNER.' },
  OWNER_CANNOT_LEAVE:        { status: 409, message: 'Workspace OWNER cannot leave; transfer ownership first.' },
  PARENT_IS_REPLY:           { status: 409, message: 'Cannot reply to a reply; threading is one level deep.' },

  INVITATION_INVALID:        { status: 410, message: 'Invitation token is invalid.' },
  INVITATION_EXPIRED:        { status: 410, message: 'Invitation has expired.' },

  VALIDATION_ERROR:          { status: 422, message: 'One or more fields are invalid.' },
  ASSIGNEE_NOT_MEMBER:       { status: 422, message: 'Assignee must be an active member of the workspace.' },
  USER_NOT_MEMBER:           { status: 422, message: 'Target user is not an active workspace member.' },
  CHECKLIST_LIMIT:           { status: 422, message: 'Checklist limit exceeded.' },
  INVALID_FILE:              { status: 422, message: 'Uploaded file is invalid.' },

  RATE_LIMITED:              { status: 429, message: 'Too many requests, please slow down.' },

  NOT_IMPLEMENTED:           { status: 501, message: 'Endpoint not implemented yet.' },
  INTERNAL_ERROR:            { status: 500, message: 'Internal server error.' },
});

module.exports = ERROR_CODES;
