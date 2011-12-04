"""
check for all our view permissions after a syncdb

from: http://blog.nyaruka.com/adding-a-view-permission-to-django-models
"""

import inspect

from django.db.models import Model
from django.db.models.signals import post_syncdb
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import Permission

def add_related_objects_permissions(app, created_models, verbosity, **kwargs):
	"""
	This syncdb hooks takes care of adding a view permission too all our
	content types.
	"""
	#print "add_view_permissions", app, len(created_models), verbosity, kwargs
	# for each of our content types
	for name, obj in inspect.getmembers(app):
		if not (inspect.isclass(obj) and issubclass(obj, Model) and obj != Model): continue
		for f in obj._meta.many_to_many:
			# build our permission slug
			codename = "assign_%s_to_%s" % (obj._meta.module_name, f.rel.to._meta.module_name)
			perm_name = "Assign %s to %s" % (obj._meta.object_name, f.rel.to._meta.object_name)

			# if it doesn't exist..
			content_type = ContentType.objects.get_for_model(obj)
			if not Permission.objects.filter(content_type=content_type, codename=codename):
				# add it
				Permission.objects.create(content_type=content_type, codename=codename, name=perm_name)
				#if verbosity >= 2:
				print "Added permission:", perm_name

post_syncdb.connect(add_related_objects_permissions, dispatch_uid = "extpiston.management.create_permissions")
