import os
import asyncio
import logging
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.account import GetAuthorizationsRequest, ResetAuthorizationRequest

logging.basicConfig(level=logging.INFO)

class SessionWatchdog:
    def __init__(self, api_id: int, api_hash: str, session_string: str):
        self.api_id = api_id
        self.api_hash = api_hash
        self.session_string = session_string

    async def get_active_sessions(self):
        """
        Retrieves all active sessions for the connected Telegram account.
        """
        if not self.session_string:
            return []

        client = TelegramClient(StringSession(self.session_string), self.api_id, self.api_hash)
        await client.connect()
        if not await client.is_user_authorized():
            await client.disconnect()
            return []

        try:
            authorizations = await client(GetAuthorizationsRequest())
            sessions_data = []
            for auth in authorizations.authorizations:
                sessions_data.append({
                    "hash": auth.hash,
                    "device_model": auth.device_model,
                    "platform": auth.platform,
                    "system_version": auth.system_version,
                    "api_id": auth.api_id,
                    "app_name": auth.app_name,
                    "app_version": auth.app_version,
                    "date_created": str(auth.date_created),
                    "date_active": str(auth.date_active),
                    "ip": auth.ip,
                    "country": auth.country,
                    "current": auth.current
                })
            return sessions_data
        except Exception as e:
            logging.error(f"Error fetching authorizations: {e}")
            return []
        finally:
            await client.disconnect()

    async def enforce_device_limit(self, device_limit: int, whitelisted_hashes: list = None):
        """
        Checks active sessions against device_limit.
        If sessions exceed device_limit, revokes non-current, non-whitelisted excess sessions.
        """
        whitelisted_hashes = whitelisted_hashes or []
        sessions = await self.get_active_sessions()
        
        if len(sessions) <= device_limit:
            return {"status": "ok", "action": "none", "count": len(sessions)}

        # Sort sessions by activity date (keep newest allowed or current session)
        client = TelegramClient(StringSession(self.session_string), self.api_id, self.api_hash)
        await client.connect()
        
        kicked_count = 0
        try:
            for s in sessions:
                if s["current"]:
                    continue  # Never kick current watchdog session
                
                # Check if we still exceed limit and this session is not whitelisted
                if (len(sessions) - kicked_count) > device_limit and s["hash"] not in whitelisted_hashes:
                    try:
                        await client(ResetAuthorizationRequest(hash=s["hash"]))
                        kicked_count += 1
                        logging.info(f"Kicked session: {s['device_model']} (IP: {s['ip']})")
                    except Exception as ex:
                        logging.error(f"Failed to reset authorization {s['hash']}: {ex}")

            return {
                "status": "warning",
                "action": "kicked",
                "kicked_count": kicked_count,
                "remaining_sessions": len(sessions) - kicked_count
            }
        finally:
            await client.disconnect()
