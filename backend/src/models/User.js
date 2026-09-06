/**
 * @deprecated The generic User model has been decommissioned.
 * All user identities now reside in their dedicated collections:
 * - Students: `Student.js` -> `students`
 * - System Admins: `Admin.js` -> `admins`
 * - Department Heads: `Department.js` -> `departments.head`
 */
import { Student } from './Student.js';
import { Admin } from './Admin.js';

export { Student, Admin };
export const User = null;
export default { Student, Admin };
