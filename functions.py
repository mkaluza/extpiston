# vim: set fileencoding=utf-8
# $Id$
# $Revision$

import time

import log,logging
logger = logging.getLogger(__name__)

import inspect

def lineno():
	"""Returns the current line number in our program."""
	return inspect.currentframe().f_back.f_lineno

def getFields(cursor):
	return [f[0] for f in cursor.description]

class Timer():
	def __init__(self, name=None):
		self.start=time.time()
		self.times=[['init',self.start]]
		self.name = name
	
	def __call__(self,desc = None):
		self.time(desc)

	def time(self,desc = None):
		if desc == None: desc = 'entry #%d' % len(self.times)

		self.times.append([desc,time.time()])
	
	def total(self):
		return self.times[len(self.times)-1][1]-self.start

	def show(self,desc=None):
		if not desc: desc = 'end'
		self.time(desc)
		total = self.total()
		if self.name:
			print "Timings for %s:" % self.name

		for i in range(1,len(self.times)):
			tm=self.times[i][1]-self.times[i-1][1]
			print "%-20s: %6.4f %3.1f%%" %(self.times[i][0],tm,100*tm/total)
			#logger.debug("%-20s: %6.4f %3.1f%%" %(self.times[i][0],tm,100*tm/total))
		print "%-20s: %6.4f\n" % ('Total',total)
		#logger.debug("%-20s: %6.4f" % ('Total',total))

def str_timedelta(dt):
	return "%d m %d s" % (dt.seconds/60,dt.seconds%60)

def pause(delay=None):
	if not delay:
		print "press enter"
		raw_input()
	else:
		print "sleeeeeeeep %d" %delay
		time.sleep(delay)

def mprint(obj, skip_defaults = True, show_nulls=False):
	for k,v in sorted(model_to_dict(obj).items(),key = lambda x: x[0]):
		f = obj._meta.get_field_by_name(k)[0]
		if v == f.default and skip_defaults: continue
		if (v != None and v != '') or show_nulls: print '%s:' % k,v

def request_debug(func):
	def wrapper(self,request,*args,**kwargs):
		print "REQUEST:",self.__class__.__name__, func.__name__
		try:
			print 'data',request.data
		except: pass
		try:
			print 'params',request.params
		except: pass
		print 'args', args
		print 'kwargs', kwargs
		return func(self,request,*args,**kwargs)
	return wrapper

def request_debug2(show_sql):	#this can only decorate class methods
	#TODO make parameter optional as in django.contrib.auth.decorators
	def _request_debug(func):
		def wrapper(self,request,*args,**kwargs):
			try:
				print 'data',request.data
			except: pass
			try:
				print 'params',request.params
			except: pass
			print 'args', args
			print 'kwargs', kwargs
			if show_sql: setattr(request,'FORCE_QUERY_DUMP',True)
			return func(self,request,*args,**kwargs)
		return wrapper
	return _request_debug
