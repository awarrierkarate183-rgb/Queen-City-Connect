window.QCCSaves = {
  keyName: function (name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  },

  snapshot: function (resource, previous) {
    const now = new Date().toISOString();
    const next = {
      id: Number(resource.id),
      key: this.keyName(resource.name),
      name: String(resource.name || '').slice(0, 160),
      category: String(resource.category || '').slice(0, 60),
      description: String(resource.description || '').slice(0, 800),
      address: String(resource.address || '').slice(0, 200),
      phone: String(resource.phone || '').slice(0, 80),
      website: String(resource.website || '').slice(0, 300),
      hours: String(resource.hours || '').slice(0, 160),
      opportunities: Array.isArray(resource.opportunities) ? resource.opportunities.map(String).slice(0, 8) : [],
      verified: resource.verified === true,
      savedAt: (previous && previous.savedAt) || now,
      updatedAt: now
    };
    if (previous &&
      previous.id === next.id &&
      previous.name === next.name &&
      previous.phone === next.phone &&
      previous.website === next.website &&
      previous.hours === next.hours &&
      previous.address === next.address &&
      previous.description === next.description &&
      previous.category === next.category &&
      JSON.stringify(previous.opportunities || []) === JSON.stringify(next.opportunities)
    ) {
      return previous;
    }
    return next;
  },

  snapshotsFor: function (ids, resources, previous) {
    const byId = {};
    (resources || []).forEach((resource) => {
      byId[Number(resource.id)] = resource;
    });
    const snaps = {};
    (ids || []).forEach((rawId) => {
      const id = Number(rawId);
      const existing = previous && previous[String(id)];
      const resource = byId[id];
      if (resource) snaps[String(id)] = this.snapshot(resource, existing);
      else if (existing) snaps[String(id)] = existing;
    });
    return snaps;
  },

  resolve: function (id, liveById, liveByKey, snapshots) {
    const snap = snapshots && snapshots[String(id)];
    const live = liveById[id] || (snap && liveByKey[snap.key || this.keyName(snap.name)]);
    if (live) {
      return { resource: live, fromSnapshot: false, id: Number(live.id) };
    }
    if (snap && snap.name) {
      return { resource: snap, fromSnapshot: true, id: Number(id) };
    }
    return null;
  }
};
