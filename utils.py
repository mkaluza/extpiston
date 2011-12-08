# vim: set fileencoding=utf-8

from django.utils import simplejson

from piston.utils import Mimer

def form_loader(request):
	"""
	Handles form uploads via XHR and editorgrid/JsonWriter uploads with encode: true
	"""
	def fix_bools(d):
		for k, v in d.iteritems():
			if v =='false': d[k] = False
			elif v =='true': d[k] = True
		return d

	meth = request.method
	data = dict([(k,v) for k,v in getattr(request,meth, {}).iteritems()])

	if '_dc' in data: del data['_dc']

	if meth == 'GET':
		data = fix_bools(data)
		request.params = dict(getattr(request, 'params', {}), **data)
		return {}		#actually params in GET from forms and grids are params, not data...

	if 'data' in data:
		if type(data['data']) in [unicode,str]: 			#when jsonWriter.encode==true
			data['data'] = simplejson.loads(data['data'])

	params = dict([(k,v) for k,v in request.GET.iteritems()])		#on PUT and POST and DELETE params can be in url (GET)
	request.params.update(params)
	return data

class ExtMimer(Mimer):
	def content_type(self):
		ctype = self.request.META.get('CONTENT_TYPE', None)
		if not ctype: return None
		return ctype.split(' ')[0].replace(';','')

	def translate(self):
		request = self.request
		olddata = None
		ctype = self.content_type()
		request.content_type = ctype
		if not hasattr(request, 'params'): request.params = {}
		if not hasattr(request, 'data'): request.data = {}

		if ctype == 'application/x-www-form-urlencoded' or request.method=='GET':
			request.data.update(form_loader(self.request))
		else:
			olddata = request.data
			super(ExtMimer, self).translate()
			if request.data == None: request.data = {}

		if 'data' in request.data:
			#this will be from the grid
			data = request.data['data']
			del request.data['data']
			request.params.update(request.data)
			request.data = data

		if olddata:
			request.data.update(olddata)

		for k,v in request.data.iteritems():
			if v == '': request.data[k] = None
