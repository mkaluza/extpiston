# vim: set fileencoding=utf-8

from django.core.serializers.json import DateTimeAwareJSONEncoder
from django.utils.encoding import force_unicode
from django.utils.functional import Promise

class LazyJSONEncoder(DateTimeAwareJSONEncoder):
	def default(self, obj):
		if isinstance(obj, Promise):
			return force_unicode(obj)
		return super(LazyJSONEncoder, self).default(obj)

DefaultJSONEncoder = LazyJSONEncoder

