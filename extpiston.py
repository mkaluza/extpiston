# $Revision: 1.9 $
# vim: set fileencoding=utf-8

from piston.handler import BaseHandler
from piston.utils import rc, require_mime, require_extended, validate
#from piston.authentication import DjangoAuthentication

from django.forms.models import model_to_dict
import types
from django.contrib.auth.models import Permission,Group,User
from django.db.models.query import QuerySet
class DjangoAuthorization():
	"""
	sposoby definiowania:
	- dla wszystkich (domyslnie), 
	- dla okreslonej metody('create','read', 'update','delete'),
	- do modyfikacji (write='create','update','delete')

	łączenie warunków
	- list - OR
	- tuple - AND
	- dict - domyślnie OR, chyba że ma logic:and

	predykaty:
	- funkcja - dostaje request, zwraca bool
	- user(s) - request.user musi w tym byc
	- group(s) - user musi byc w grupie
	- perm(s) - musi miec permsa
	- key-value - dany parametr usera musi miec taka wartosc
	- key - flaga - musi miec wartość true lub równoważną

	"""

	def __init__(self,*args,**kwargs):
		method_names = set(['create','read','update','delete','write'])
		self.method_authz={}
		def_names = method_names & set(kwargs.keys())
		for m in def_names:
			self.method_authz[m]=kwargs.pop(m)
		args=list(args)
		args.append(kwargs)
		print args
		self.method_authz['all'] = args
	def parse(self,request,el):
		print "parse:",el
		u=model_to_dict(request.user)
		if isinstance(el,types.FunctionType) or isinstance(el,types.LambdaType):
			return el(request)
		elif isinstance(el,dict):
			print "dict"
			if el.has_key('LOGIC') and el['LOGIC'].upper()=='AND':	#default logic is OR
				#AND
				for k,v in el.iteritems(): 
					if k in ['group','user','perm']:
						#TODO zamienic string na obiekt przy pomocy generic relatio
						if not self.parse(request,v): return False
					else:
						if u[k] != v: return False
				return True
			else:
				#OR
				for k,v in el.iteritems(): 
					if k in ['group','user','perm']:
						if self.parse(request,v): return True
					else:
						if u[k] == v: return True
				return False
		elif isinstance(el,list):
			for e in el:
				if self.parse(request,e): return True
			return False	#OR
		elif isinstance(el,tuple):
			for e in el:
				if not self.parse(request,e): return False
			return True	#AND
		elif isinstance(el,User):
			return request.user==el
		elif isinstance(el,Group):
			return el in request.user.groups.all()
		elif isinstance(el,Permission):
			return request.user.has_perm(el)
		else:
			print 'flag',str(el),u.has_key(str(el))
			print u
			return u.has_key(str(el)) and u[str(el)]
	def authorize(self,request,method):
		res=False
		if self.method_authz.has_key(method):
			res=self.parse(request,self.method_authz[method])
		else:
			if method in ['create','update','delete'] and self.method_authz.has_key('write'):
				res=self.parse(request,self.method_authz['write'])
			else:
				res=self.parse(request,self.method_authz['all'])
		return res
		
class ExtHandler(BaseHandler):
	#exclude = ()
	def fix_data(self,request):
		if hasattr(request,'data_fixed'): return request
		req_data=getattr(request,request.method)
		if req_data.has_key('data'):
			request.data = simplejson.loads(req_data.get('data'))
		else:
			if len(request.data)==1 and request.data.has_key('data'):
				request.data=request.data['data']
		setattr(request,'data_fixed',True)
		print "request.data.fixed:", request.data
		return request

	def create(self, request, *args, **kwargs):
		request = self.fix_data(request)
		print "create"
		if not self.has_model():
			return rc.NOT_IMPLEMENTED

		attrs = self.flatten_dict(request.data)

		try:
			pkfield = self.model._meta.pk.name
			#if pkfield in attrs: 
			#niepotrzebne - jak nie ma, to sie wywali, jak jest i nie znajdzie, to tez sie wywali, a jak znajdzie, to powie ze juz istnieje
			inst = self.queryset(request).get(pk=attrs[pkfield])
			return rc.DUPLICATE_ENTRY
		except (self.model.DoesNotExist, KeyError):
			modelfields=set(self.model._meta.get_all_field_names())
			fields=set(attrs.keys())
			modeldata = {}
			#Only model fields
			for f in fields & modelfields: modeldata[f] = attrs[f]

			inst = self.model(**modeldata)
			#the rest (properties)
			for f in fields - modelfields:
				if hasattr(inst,f): setattr(inst,f,attrs[f])
			inst.save()
			return inst
		except self.model.MultipleObjectsReturned:
			return rc.DUPLICATE_ENTRY

#	def create(self, request, *args, **kwargs):
#		request = self.fix_data(request)
#		return super(ExtHandler, self).create(request, *args, **kwargs)
		#return self.read(request,pk=result.pk) #tak trzeba, jesli mamy swoje queryset

	def update(self, request, *args, **kwargs):
		request = self.fix_data(request)
		super(ExtHandler, self).update(request,  *args, **kwargs)
		return self.read(request,*args, **kwargs)

	
"""
from piston_demo.todos.models import Task
from piston_demo.todos.forms import TaskForm

class TaskHandler(ExtHandler):
	fields = ('id', 'name', 'complete')
	model = Task   
"""

from django.utils import simplejson
from django.core.serializers.json import DateTimeAwareJSONEncoder

from piston.emitters import Emitter

def flatten_dict(d,name=None):
#	print "flatten_dict",d,name
	if not isinstance(d,dict):return d
	res=[]
	for k,v in d.iteritems():
		if name:
			newname="%s__%s"%(name,k)
		else: newname=k
#		print newname,type(v),v
		if isinstance(v,dict):
			res+=flatten_dict(v,newname).items()
		else:
			res.append((newname,v))
	return dict(res)

def paginate(request,q):
	limit=None
	#start = int(request.GET.get('start'))
	start = request.GET.get('start')
	if start != None:
		start = int(start)
		#limit = start+int(request.GET.get('limit'))
		limit = request.GET.get('limit')
		if limit != None: limit = start + int(limit)
	if start == None or limit == None: return q
	return q[start:limit]

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
		print 'RENDER'
		print type(data)

		if isinstance(data,QuerySet):
			cnt = data.count()
			data = paginate(request,data.all())
		else: cnt = None

		if isinstance(data,(list,tuple)):
			if cnt == None: 
				cnt = len(data)
				data = paginate(request,data)
			data = [flatten_dict(d) for d in data]
			#ext_dict['data'] = [flatten_dict(d) for d in data]
		else:
			cnt = 1
			data = flatten_dict(data)
			#ext_dict['data'] = flatten_dict(data)
		ext_dict = {'success': True, 'data': data, 'message': 'Something good happened on the server!', 'totalCount': cnt}
		seria = simplejson.dumps(ext_dict, cls=DateTimeAwareJSONEncoder, ensure_ascii=False, indent=4)

		# Callback
		if cb:
			return '%s(%s)' % (cb, seria)

		return seria
	
Emitter.register('ext-json', ExtJSONEmitter, 'application/json; charset=utf-8')


from piston.resource import Resource
class ExtResource(Resource):
	def determine_emitter(self, request, *args, **kwargs):
		em = kwargs.pop('emitter_format', None)
		if not em:
			em = request.GET.get('format', 'ext-json')
		
		return em

	def urls(self,*args,**kwargs):
		#args are numbers by default
		from django.conf.urls.defaults import url
		name = self.handler.model.__name__.lower()
		urls=[]
		for k in args: urls.append(url(r'%s/%s/(?P<%s>\d+)$' % (name,k,k),self))
		for k,v in kwargs.iteritems(): urls.append(url(r'%s/%s/(?P<%s>%s)$' % (name,k,k,v),self))
		return urls+[url(r'^%s/(?P<id>\d+)$' % name, self), url(r'^%s$' % name, self)]

	def columns(self):
		columns = [{'header':f.verbose_name,'dataIndex':f.name,'tooltip':f.help_text} for f in self.handler.model._meta.fields]
		return simplejson.dumps(columns, cls=DateTimeAwareJSONEncoder, ensure_ascii=False, indent=4)



"""
task_resource = ExtResource(TaskHandler)

urlpatterns = patterns('',
   url(r'^tasks/(?P<id>\d+)$', task_resource),
   url(r'^tasks$', task_resource),
#   url(r'^tasks/(?P<id>\d+)$', task_resource,  {'emitter_format': 'ext-json'}),
#   url(r'^tasks$', task_resource, {'emitter_format': 'ext-json'}),   
   #url(r'^tasks$', task_resource) # for basic example
)
"""
