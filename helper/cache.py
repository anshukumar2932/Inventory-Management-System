import functools
import hashlib
import json

from django.core.cache import cache


def cached(ttl_seconds=300):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            user = None
            for arg in args:
                if hasattr(arg, 'is_authenticated'):
                    user = arg
                    break
            if kwargs.get('user') is not None:
                user = kwargs['user']
            user_id = getattr(user, 'id', 'anonymous') if user else 'anonymous'
            role = getattr(user, 'role', 'anonymous') if user else 'anonymous'

            cache_key = f"{func.__module__}:{func.__name__}:{user_id}:{role}:{hashlib.md5(json.dumps(kwargs, sort_keys=True, default=str).encode()).hexdigest()}"
            result = cache.get(cache_key)
            if result is not None:
                return result
            result = func(*args, **kwargs)
            cache.set(cache_key, result, ttl_seconds)
            return result
        return wrapper
    return decorator


def invalidate_cache(pattern_prefix):
    try:
        from django.core.cache import cache
        keys = cache.keys(f"{pattern_prefix}*")
        if keys:
            cache.delete_many(keys)
    except Exception:
        pass
