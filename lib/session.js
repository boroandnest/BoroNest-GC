// Simple session helpers - stores token in cookie, verifies against DB
import { getCollection } from './mongo';

export async function getUserFromRequest(request) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');
    if (!token) {
      const cookie = request.headers.get('cookie') || '';
      const match = cookie.match(/bn_token=([^;]+)/);
      token = match?.[1];
    }
    if (!token) return null;
    const users = await getCollection('users');
    return await users.findOne({ token });
  } catch (e) {
    return null;
  }
}
