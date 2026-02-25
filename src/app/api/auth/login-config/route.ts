import prisma from '@/lib/prisma';
import { json } from '@/lib/response';

export async function GET() {
  // Public endpoint - no authentication required
  // Only returns whether there's a primary SSO provider (no sensitive data)
  const primaryProvider = await prisma.client.oidcProvider.findFirst({
    where: {
      enabled: true,
      isPrimary: true,
    },
    select: {
      id: true,
    },
  });

  return json({
    hasPrimarySsoProvider: !!primaryProvider,
  });
}
