import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? "pawkit_dev_secret_change_in_production";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

export function signToken(payload: object): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, SECRET) as jwt.JwtPayload;
}
