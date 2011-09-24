# $Revision: 1.9 $
# vim: set fileencoding=utf-8

from piston.emitters import Emitter

from django.contrib.auth.models import Permission,Group,User
from django.core.serializers.json import DateTimeAwareJSONEncoder
from django.utils import simplejson

import settings

from functions import Timer
from internal import *

class ExtJSONEmitter(Emitter):
	"""
	JSON emitter, understands timestamps, wraps result set in object literal
	for Ext JS compatibility
	"""
	def render(self, request):
		#print request
		cb = request.GET.get('callback')
		#TODO zrobic tak, zeby tu byl queryset a nie lista
		data=self.construct()

		if isinstance(data,(list,tuple)):
			data = [flatten_dict(d) for d in data]
		else:
			data = flatten_dict(data)
		ext_dict = {'success': True, 'data': data}
		if hasattr(self.handler,'success'): ext_dict['success']=self.handler.success
		if hasattr(self.handler,'message'): ext_dict['message']=self.handler.message
		if hasattr(self.handler,'extra'): ext_dict['extra']=self.handler.extra
		if hasattr(self.handler,'errors'): ext_dict['errors']=self.handler.errors
		if self.total != None: ext_dict['total'] = self.total
		seria = simplejson.dumps(ext_dict, cls=DateTimeAwareJSONEncoder, ensure_ascii=False, indent=4, sort_keys = settings.DEBUG)

		# Callback
		if cb:
			return '%s(%s)' % (cb, seria)

		return seria

	def method_fields(self, handler, fields):
		if not handler:
			return { }

		ret = super(ExtJSONEmitter,self).method_fields(handler, fields)

		for field in fields - Emitter.RESERVED_FIELDS:
			t = getattr(handler.model, str(field), None)		#check model methods as well, not only handler methods

			if t and callable(t) and field not in ret:
				ret[field] = t

		return ret

Emitter.register('ext-json', ExtJSONEmitter, 'application/json; charset=utf-8')

class ArrayJSONEmitter(Emitter):
	"""
	JSON emitter, understands timestamps, wraps result set in object literal
	for Ext JS compatibility
	"""
	def render(self, request):
		#print request
		cb = request.GET.get('callback')
		#TODO zrobic tak, zeby tu byl queryset a nie lista
		data=self.construct()

		if isinstance(data,(list,tuple)):
			data2 = [ flatten_dict(el) for el in data]
			fields = flatten_fields(self.handler.fields)
			data = [[ el.get(fname,"") for fname in fields] for el in data2]
		else:
			#TODO zrobic z tego array wtedy?
			data = flatten_dict(data)
		seria = simplejson.dumps(data, cls=DateTimeAwareJSONEncoder, ensure_ascii=False)

		# Callback
		if cb:
			return '%s(%s)' % (cb, seria)

		return seria

Emitter.register('array-json', ArrayJSONEmitter, 'application/json; charset=utf-8')
